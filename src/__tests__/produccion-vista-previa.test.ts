import { describe, expect, it } from 'vitest'
import type { ParametrosDeProduccion, Producto } from '@/lib/api-types'
import { preverCierre } from '@/lib/produccion'

/**
 * La vista previa del cierre.
 *
 * ── El caso espejo ──────────────────────────────────────────────────────────
 *
 * `CASO` y `ESPERADO` están repetidos, con los mismos números, en el test
 * `«el cierre escribe lo que la pantalla prometió»` de
 * `api/src/modules/produccion/__tests__/routes.test.ts`.
 *
 * Están en dos repos, así que ningún import los puede atar. Lo que los ata es
 * que **los dos tests usan los mismos literales**: si alguien cambia la
 * aritmética de un lado, ese lado falla y el otro no, y la diferencia aparece
 * como un test rojo en vez de como un número equivocado en pantalla.
 *
 * Si tocás uno, tocá el otro.
 */

const PARAMETROS: ParametrosDeProduccion = {
  litrosPorGalon: 3.785,
  rendimiento: 0.7,
  insumosPorBotellon: ['TAPA_20L', 'SELLO_BOTELLON'],
}

/** Solo lo que `preverCierre` mira: código, nombre y litros. */
function producto(codigo: string, nombre: string, litros: string): Producto {
  return { codigo, nombre, litros } as Producto
}

const CATALOGO = [
  producto('P20U_600ML', 'Paca de 20 bolsas de 600 ml', '12.000'),
  producto('P50U_300ML', 'Paca de 50 bolsas de 300 ml', '15.000'),
  producto('BOT_20L', 'Recarga de botellón de 20 L', '20.000'),
]

const CASO = {
  minutosProcesando: 120,
  pacas600: 10,
  pacas300: 5,
  botellonesLlenados: 30,
  botellonesLavados: 0,
  caudalGpm: 2,
}

/** 10×12 + 5×15 + 30×20 = 795 · 2 × 120 × 3,785 × 0,7 = 635,88 → 636 */
const ESPERADO = { litrosConsumidos: 795, litrosProcesados: 636, litrosCrudosConsumidos: 909 }

describe('preverCierre', () => {
  it('calcula los tres números que el cierre va a escribir', () => {
    const previa = preverCierre(CASO, PARAMETROS, CATALOGO)

    expect(previa).toMatchObject(ESPERADO)
  })

  it('un lote por producto envasado, y ninguno por lo que quedó en cero', () => {
    const previa = preverCierre({ ...CASO, pacas300: 0 }, PARAMETROS, CATALOGO)

    expect(previa.lotes.map((l) => l.codigoDeProducto)).toEqual(['P20U_600ML', 'BOT_20L'])
  })

  it('una tapa y un sello por botellón envasado', () => {
    expect(preverCierre(CASO, PARAMETROS, CATALOGO).insumosConsumidos).toBe(30)
  })

  /**
   * ── El `null` es información, no un hueco ─────────────────────────────────
   *
   * Sin caudal medido no se puede calcular el procesamiento, y el sistema lo
   * dice en vez de estimarlo. Un cero acá sería peor que un `null`: parecería
   * que ese día no se procesó nada.
   */
  it('sin caudal, el procesamiento queda en `null` — no en cero', () => {
    const previa = preverCierre(
      { ...CASO, caudalGpm: undefined },
      PARAMETROS,
      CATALOGO,
    )

    expect(previa.litrosProcesados).toBeNull()
    expect(previa.litrosCrudosConsumidos).toBeNull()
    // Pero el envasado se sabe igual: eso no depende del caudal.
    expect(previa.litrosConsumidos).toBe(795)
  })

  it('avisa que falta medir el lavado antes de que `api/` lo rechace', () => {
    const previa = preverCierre({ ...CASO, botellonesLavados: 20 }, PARAMETROS, CATALOGO)

    expect(previa.faltaMedirElLavado).toBe(true)
  })

  it('con la medición cargada, el lavado suma al consumo', () => {
    const previa = preverCierre(
      { ...CASO, botellonesLavados: 20, litrosPorLavado: 3 },
      PARAMETROS,
      CATALOGO,
    )

    expect(previa.faltaMedirElLavado).toBe(false)
    expect(previa.litrosConsumidos).toBe(795 + 60)
  })

  /**
   * Un producto que falte NO se resuelve con cero: el consumo saldría
   * subestimado, el balance cerraría con un número que parece correcto, y
   * nadie lo relacionaría con el producto faltante. `api/` rechaza el cierre
   * por esto mismo, y la pantalla lo anticipa.
   */
  it('nombra el producto que falta en el catálogo en vez de contarlo como cero', () => {
    const previa = preverCierre(CASO, PARAMETROS, CATALOGO.slice(0, 2))

    expect(previa.productosFaltantes).toEqual(['BOT_20L'])
  })

  /**
   * ── Por qué se redondea AL FINAL ──────────────────────────────────────────
   *
   * Redondear cada término acumula una diferencia que después nadie puede
   * explicar. Con litros fraccionarios en el catálogo, redondear por producto
   * daría 12 + 15 = 27 y el total real es 26.
   */
  it('redondea el total, no cada término', () => {
    const fraccionario = [
      producto('P20U_600ML', 'Paca de 600', '11.500'),
      producto('P50U_300ML', 'Paca de 300', '14.500'),
    ]

    const previa = preverCierre(
      { ...CASO, pacas600: 1, pacas300: 1, botellonesLlenados: 0 },
      PARAMETROS,
      fraccionario,
    )

    expect(previa.litrosConsumidos).toBe(26)
  })
})
