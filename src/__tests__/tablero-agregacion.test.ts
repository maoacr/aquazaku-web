import { describe, expect, it } from 'vitest'
import type { MovimientoDePlata } from '@/lib/api-types'
import { cubetas, periodoAnterior, totalesDelPeriodo, variacion } from '@/lib/tablero'

/**
 * La agregación del tablero.
 *
 * `/reportes/extracto` devuelve el movimiento SUELTO. Agruparlo por día, semana
 * o mes lo hace el BFF, y acá está toda la aritmética que puede mentir sin que
 * se note: qué tipo cuenta como venta, qué pasa con un día sin movimiento, y si
 * la suma arrastra error de coma flotante.
 */

function mov(sobrescribe: Partial<MovimientoDePlata> = {}): MovimientoDePlata {
  return {
    fecha: '2026-09-10',
    tipo: 'venta',
    contraparte: 'Panadería',
    monto: '100000.00',
    signo: 1,
    medioDePago: 'efectivo',
    documentoId: 'id',
    detalle: null,
    ...sobrescribe,
  }
}

describe('qué cuenta como vendido y qué como cobrado', () => {
  it('la venta suma a vendido', () => {
    const [punto] = cubetas([mov()], { desde: '2026-09-10', hasta: '2026-09-10', granularidad: 'dia' })

    expect(punto!.vendido).toBe(100000)
    expect(punto!.cobrado).toBe(0)
  })

  /**
   * El recargo por daño a una base es una venta de tipo `dano_base`: entra
   * plata por algo que se entregó. `api/` ya lo separa en su propio tipo para
   * que el contador lo distinga, pero en el tablero suma al mismo lado.
   */
  it('el recargo también es plata vendida', () => {
    const [punto] = cubetas([mov({ tipo: 'recargo', monto: '30000.00' })], {
      desde: '2026-09-10',
      hasta: '2026-09-10',
      granularidad: 'dia',
    })

    expect(punto!.vendido).toBe(30000)
  })

  it('el cobro va a su propia serie', () => {
    const [punto] = cubetas([mov({ tipo: 'cobro', monto: '50000.00' })], {
      desde: '2026-09-10',
      hasta: '2026-09-10',
      granularidad: 'dia',
    })

    expect(punto!.vendido).toBe(0)
    expect(punto!.cobrado).toBe(50000)
  })

  /**
   * ── Lo que NO entra, y por qué ────────────────────────────────────────────
   *
   * La compra es plata que SALE: sumarla a «vendido» invertiría el signo del
   * negocio. La devolución acredita contra la deuda y tampoco es una venta.
   * Las dos están en el extracto porque el contador las concilia; este gráfico
   * contesta otra pregunta.
   */
  it('la compra y la devolución no son ni venta ni cobro', () => {
    const [punto] = cubetas(
      [mov({ tipo: 'compra', monto: '900000.00', signo: -1 }), mov({ tipo: 'devolucion', monto: '20000.00', signo: -1 })],
      { desde: '2026-09-10', hasta: '2026-09-10', granularidad: 'dia' },
    )

    expect(punto!.vendido).toBe(0)
    expect(punto!.cobrado).toBe(0)
  })
})

describe('las cubetas cubren el rango entero', () => {
  /**
   * Un día ausente se lee como «no lo consulté». Uno en cero dice «no pasó
   * nada», que es un dato — y en una planta que factura todos los días, un cero
   * es una alarma. Es el mismo criterio que `resumenMensual` en `api/`.
   */
  it('un día sin movimiento aparece en cero, no desaparece', () => {
    const puntos = cubetas([mov({ fecha: '2026-09-10' })], {
      desde: '2026-09-08',
      hasta: '2026-09-11',
      granularidad: 'dia',
    })

    expect(puntos).toHaveLength(4)
    expect(puntos.map((p) => p.vendido)).toEqual([0, 0, 100000, 0])
  })

  it('agrupa por semana, de lunes a domingo', () => {
    // El 7 de septiembre de 2026 es lunes; el 14, el lunes siguiente.
    const puntos = cubetas(
      [mov({ fecha: '2026-09-09' }), mov({ fecha: '2026-09-13' }), mov({ fecha: '2026-09-15' })],
      { desde: '2026-09-07', hasta: '2026-09-20', granularidad: 'semana' },
    )

    expect(puntos).toHaveLength(2)
    expect(puntos[0]!.vendido).toBe(200000)
    expect(puntos[1]!.vendido).toBe(100000)
  })

  it('agrupa por mes y no se saltea el mes vacío del medio', () => {
    const puntos = cubetas([mov({ fecha: '2026-07-10' }), mov({ fecha: '2026-09-10' })], {
      desde: '2026-07-01',
      hasta: '2026-09-30',
      granularidad: 'mes',
    })

    expect(puntos.map((p) => p.vendido)).toEqual([100000, 0, 100000])
  })

  it('cada cubeta trae una etiqueta para el eje', () => {
    const puntos = cubetas([], { desde: '2026-09-10', hasta: '2026-09-11', granularidad: 'dia' })

    expect(puntos.every((p) => p.etiqueta.length > 0)).toBe(true)
  })
})

describe('la plata se suma en centavos', () => {
  /**
   * ── El descuadre de un centavo que nadie puede explicar ───────────────────
   *
   * `0.1 + 0.2` en coma flotante da `0.30000000000000004`. Con treinta
   * movimientos de montos con decimales, el total del tablero deja de coincidir
   * con el del extracto — y dos reportes del mismo negocio que no coinciden
   * obligan a desconfiar de los dos.
   */
  it('sumar los decimales crudos descuadra: 0,10 + 0,20 + 0,30', () => {
    const [punto] = cubetas(
      [mov({ monto: '0.10' }), mov({ monto: '0.20' }), mov({ monto: '0.30' })],
      { desde: '2026-09-10', hasta: '2026-09-10', granularidad: 'dia' },
    )

    // Sumados crudos dan 0.6000000000000001.
    expect(punto!.vendido).toBe(0.6)
  })

  /**
   * ── Y escalar por cien tampoco alcanza: hay que REDONDEAR ─────────────────
   *
   * Este caso lo encontré midiendo, después de que una ablación no matara nada:
   * saqué el `Math.round` de `aCentavos` y los tests siguieron verdes, porque
   * con 0,10 / 0,20 / 0,30 el `* 100` ya da enteros exactos y el redondeo no
   * cambiaba nada. El test probaba el escalado, no el redondeo.
   *
   * `0.07 * 100` da `7.000000000000001`. Estos tres son de los montos donde el
   * producto NO es entero, así que sin `Math.round` la suma da
   * `0.49000000000000005` — un centavo fantasma que aparece recién cuando
   * alguien compara el tablero contra el extracto.
   */
  it('escalar sin redondear también descuadra: 0,07 + 0,14 + 0,28', () => {
    const [punto] = cubetas(
      [mov({ monto: '0.07' }), mov({ monto: '0.14' }), mov({ monto: '0.28' })],
      { desde: '2026-09-10', hasta: '2026-09-10', granularidad: 'dia' },
    )

    expect(punto!.vendido).toBe(0.49)
  })
})

describe('los totales del período', () => {
  it('separa vendido de cobrado', () => {
    const t = totalesDelPeriodo([
      mov({ monto: '100000.00' }),
      mov({ tipo: 'cobro', monto: '40000.00' }),
      mov({ tipo: 'compra', monto: '10000.00', signo: -1 }),
    ])

    expect(t.vendido).toBe('100000.00')
    expect(t.cobrado).toBe('40000.00')
  })
})

describe('el período anterior, para comparar', () => {
  /**
   * La ventana previa del MISMO largo, pegada al `desde`. Treinta días contra
   * treinta días; comparar contra un mes calendario daría meses de 28 y de 31
   * y la variación mentiría por el largo, no por el negocio.
   */
  it('es la ventana previa del mismo largo', () => {
    expect(periodoAnterior({ desde: '2026-09-11', hasta: '2026-09-20' })).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-10',
    })
  })

  it('un solo día compara contra el día anterior', () => {
    expect(periodoAnterior({ desde: '2026-09-10', hasta: '2026-09-10' })).toEqual({
      desde: '2026-09-09',
      hasta: '2026-09-09',
    })
  })
})

describe('la variación', () => {
  it('sube', () => {
    expect(variacion('110000.00', '100000.00')).toEqual({ texto: '+10,0 %', direccion: 'sube' })
  })

  it('baja', () => {
    expect(variacion('90000.00', '100000.00')).toEqual({ texto: '−10,0 %', direccion: 'baja' })
  })

  it('igual', () => {
    expect(variacion('100000.00', '100000.00')).toEqual({ texto: '0,0 %', direccion: 'igual' })
  })

  /**
   * ── Dividir por cero no da «infinito por ciento» ──────────────────────────
   *
   * Si el período anterior fue cero, cualquier porcentaje es una división por
   * cero. «+∞ %» o «+100 %» serían dos formas de inventar. Se dice lo que pasó:
   * antes no hubo nada.
   */
  it('contra un período anterior en cero no inventa un porcentaje', () => {
    expect(variacion('50000.00', '0.00')).toEqual({
      texto: 'sin base previa',
      direccion: 'igual',
    })
  })
})
