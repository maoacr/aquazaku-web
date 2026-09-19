import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VistaPrevia } from '@/components/produccion/vista-previa'
import type { InsumoListado, SaldoDeAgua } from '@/lib/api-types'
import type { VistaPreviaDelCierre } from '@/lib/produccion'

/**
 * Lo que va a pasar al confirmar el cierre — M4.
 *
 * ── Por qué se adelanta acá si `api/` valida igual ──────────────────────────
 *
 * Que no alcancen las tapas o que falte la medición del lavado lo rechaza
 * `api/` con un mensaje que dice qué hacer. Adelantarlo evita llenar todo el
 * formulario para que lo rebote al enviar — pero la regla sigue viviendo de un
 * solo lado (RN-ACC-02). Acá no se decide nada.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que `null` se muestre como «sin calcular» y NO como cero. Sin caudal medido
 * el procesamiento de hoy no se puede calcular, y un cero ahí diría que no
 * entró agua — que es una afirmación, no un hueco.
 *
 * Y que cada aviso nombre lo que falta. «Faltan insumos» sin decir cuáles
 * manda a revisar el catálogo entero.
 */

function previa(over: Partial<VistaPreviaDelCierre> = {}): VistaPreviaDelCierre {
  return {
    litrosConsumidos: 1200,
    litrosProcesados: 1500,
    litrosCrudosConsumidos: 1800,
    insumosConsumidos: 60,
    botellonesLavados: 40,
    lotes: [{ codigoDeProducto: 'BOT20', nombre: 'Botellón 20L', cantidad: 60 }],
    productosFaltantes: [],
    faltaMedirElLavado: false,
    ...over,
  } as VistaPreviaDelCierre
}

function insumo(over: Partial<InsumoListado> = {}): InsumoListado {
  return {
    id: 'ins-1',
    codigo: 'TAP',
    nombre: 'Tapas',
    unidad: 'unidad',
    minimo: 100,
    saldo: 540,
    equivalenciaPorKilo: null,
    activo: true,
    bajoMinimo: false,
    ...over,
  }
}

const AGUA: SaldoDeAgua = {
  tanque: 'procesado',
  litros: 4000,
  capacidad: 4000,
  nivelCalculado: 'lleno',
}

function pintar(over: Partial<Parameters<typeof VistaPrevia>[0]> = {}) {
  return render(
    <VistaPrevia
      previa={previa()}
      insumos={[insumo()]}
      aguaProcesada={AGUA}
      insumosPorBotellon={['TAP']}
      hayAlgoQueMostrar
      {...over}
    />,
  )
}

describe('cuándo se muestra', () => {
  it('sin nada cargado no se dibuja: no hay qué previsualizar', () => {
    const { container } = pintar({ hayAlgoQueMostrar: false })

    expect(container).toBeEmptyDOMElement()
  })

  it('con datos anuncia qué va a pasar al confirmar', () => {
    pintar()

    expect(screen.getByText('Al confirmar va a pasar esto')).toBeInTheDocument()
  })

  /*
   * Va con `aria-live`: el bloque cambia mientras se tipean los conteos, y
   * quien no lo ve tiene que enterarse de que los números se movieron.
   */
  it('se anuncia para quien no lo ve', () => {
    const { container } = pintar()

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })
})

describe('los tres números de arriba', () => {
  it('dice cuánta agua sale del tanque, con separadores', () => {
    pintar()

    expect(screen.getByText('1.200')).toBeInTheDocument()
  })

  /*
   * El cálculo completo, para poder reconocer el propio error en los conteos:
   * «60 × Botellón 20L» permite ver que se tipearon 60 y no 6.
   */
  it('muestra la cuenta que da ese consumo, no solo el total', () => {
    pintar()

    expect(screen.getByText('60 × Botellón 20L')).toBeInTheDocument()
  })

  it('con varios productos los suma a la vista', () => {
    pintar({
      previa: previa({
        lotes: [
          { codigoDeProducto: 'BOT20', nombre: 'Botellón 20L', cantidad: 60 },
          { codigoDeProducto: 'PAC600', nombre: 'Paca 600', cantidad: 30 },
        ],
      } as Partial<VistaPreviaDelCierre>),
    })

    expect(screen.getByText('60 × Botellón 20L + 30 × Paca 600')).toBeInTheDocument()
  })

  it('sin nada envasado lo dice en vez de mostrar una cuenta vacía', () => {
    pintar({ previa: previa({ lotes: [] }) })

    expect(screen.getByText('Todavía no se cargó nada envasado.')).toBeInTheDocument()
  })

  /*
   * El `null` es INFORMACIÓN, no un hueco: significa que el procesamiento de
   * hoy no se va a poder calcular. Un cero diría que no entró agua.
   */
  it('sin caudal medido dice «Sin calcular», nunca cero', () => {
    pintar({
      previa: previa({ litrosProcesados: null, litrosCrudosConsumidos: null }),
    })

    expect(screen.getByText('Sin calcular')).toBeInTheDocument()
    expect(screen.getByText('Sin caudal medido no se puede calcular.')).toBeInTheDocument()
  })

  it('con caudal medido dice cuánto crudo consume', () => {
    pintar()

    expect(screen.getByText(/Consume 1.800 L de agua cruda/)).toBeInTheDocument()
  })

  it('sin botellones llenados aclara por qué no se consume nada', () => {
    pintar({ previa: previa({ insumosConsumidos: 0 }) })

    expect(screen.getByText('No se llenaron botellones.')).toBeInTheDocument()
  })

  it('con botellones explica que va uno de cada insumo', () => {
    pintar({ insumosPorBotellon: ['TAP', 'SELLO'] })

    expect(screen.getByText(/Uno de cada uno por botellón: TAP y SELLO/)).toBeInTheDocument()
  })
})

describe('los lotes que se van a generar', () => {
  it('los nombra uno por uno', () => {
    pintar()

    expect(screen.getByText('Lotes que se van a generar')).toBeInTheDocument()
    expect(screen.getByText('Botellón 20L')).toBeInTheDocument()
  })

  it('aclara el vencimiento sin que haya que abrirlos', () => {
    pintar()

    expect(screen.getByText(/30 días de vencimiento desde hoy/)).toBeInTheDocument()
  })

  it('sin lotes no dibuja la sección vacía', () => {
    pintar({ previa: previa({ lotes: [] }) })

    expect(screen.queryByText('Lotes que se van a generar')).not.toBeInTheDocument()
  })
})

/**
 * Los avisos de lo que `api/` va a rechazar.
 *
 * Cada uno nombra lo que falta: «faltan insumos» sin decir cuáles manda a
 * revisar el catálogo entero.
 */
describe('los avisos', () => {
  it('sin problemas no muestra ninguno', () => {
    pintar()

    expect(screen.queryByText(/Falta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No alcanzan/)).not.toBeInTheDocument()
  })

  /*
   * Sin la medición del lavado un término del balance quedaría en cero y el
   * agua no cuadraría nunca. Se mide una vez.
   */
  it('avisa que falta medir el lavado, y dice cuántos lavados hay', () => {
    pintar({ previa: previa({ faltaMedirElLavado: true, botellonesLavados: 40 }) })

    expect(screen.getByText('Falta la medición del lavado')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText(/Se mide una vez/)).toBeInTheDocument()
  })

  /*
   * Un producto faltante NO se resuelve con cero: el consumo saldría
   * subestimado, el balance cerraría con un número que parece correcto, y nadie
   * lo relacionaría con esto.
   */
  it('nombra el producto que falta en el catálogo', () => {
    pintar({ previa: previa({ productosFaltantes: ['PACA300'] }) })

    expect(screen.getByText('Falta un producto en el catálogo')).toBeInTheDocument()
    expect(screen.getByText(/No está PACA300/)).toBeInTheDocument()
  })

  it('explica por qué no se puede contar como cero', () => {
    pintar({ previa: previa({ productosFaltantes: ['PACA300'] }) })

    expect(screen.getByText(/parece correcto/)).toBeInTheDocument()
  })

  it('nombra el insumo que no está cargado', () => {
    pintar({ insumosPorBotellon: ['TAP', 'SELLO'], insumos: [insumo({ codigo: 'TAP' })] })

    expect(screen.getByText('Falta un insumo en el catálogo')).toBeInTheDocument()
    expect(screen.getByText(/No está SELLO/)).toBeInTheDocument()
  })

  it('avisa cuando no alcanza un insumo, con los dos números', () => {
    pintar({
      insumos: [insumo({ nombre: 'Tapas', saldo: 10 })],
      previa: previa({ insumosConsumidos: 60 }),
    })

    expect(screen.getByText('No alcanzan los insumos')).toBeInTheDocument()
    expect(screen.getByText(/Tapas: quedan/)).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  /*
   * El camino de salida, no solo el problema: si se envasaron igual, el
   * inventario estaba mal ANTES del cierre.
   */
  it('dice qué hacer si igual se envasó', () => {
    pintar({
      insumos: [insumo({ saldo: 10 })],
      previa: previa({ insumosConsumidos: 60 }),
    })

    expect(screen.getByText(/regístrelo con un ajuste/)).toBeInTheDocument()
  })

  it('un saldo justo NO dispara el aviso: alcanza exactamente', () => {
    pintar({
      insumos: [insumo({ saldo: 60 })],
      previa: previa({ insumosConsumidos: 60 }),
    })

    expect(screen.queryByText('No alcanzan los insumos')).not.toBeInTheDocument()
  })

  it('avisa cuando el libro no tiene tanta agua, con los dos saldos', () => {
    pintar({
      aguaProcesada: { ...AGUA, litros: 500 },
      previa: previa({ litrosConsumidos: 1200 }),
    })

    expect(screen.getByText('El libro dice que no hay tanta agua')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  /*
   * Ofrece las dos explicaciones posibles en vez de acusar a una: puede faltar
   * una reposición, o el saldo puede venir descuadrado de antes.
   */
  it('ofrece las dos causas posibles del descuadre', () => {
    pintar({
      aguaProcesada: { ...AGUA, litros: 500 },
      previa: previa({ litrosConsumidos: 1200 }),
    })

    expect(screen.getByText(/falte registrar una reposición/)).toBeInTheDocument()
    expect(screen.getByText(/descuadrado de antes/)).toBeInTheDocument()
  })

  it('sin saldo de agua conocido no inventa el aviso', () => {
    pintar({ aguaProcesada: undefined, previa: previa({ litrosConsumidos: 999999 }) })

    expect(screen.queryByText('El libro dice que no hay tanta agua')).not.toBeInTheDocument()
  })
})
