import { describe, expect, it } from 'vitest'
import { elegirGranularidad } from '@/components/graficos/serie-en-el-tiempo'

/**
 * La serie de tiempo del tablero.
 *
 * ── Lo que NO se prueba acá, y por qué ──────────────────────────────────────
 *
 * El dibujo. Recharts mide su contenedor para saber cuánto espacio tiene, y en
 * jsdom **no hay layout**: todo mide 0×0, así que el gráfico renderiza vacío
 * pase lo que pase. Un test que afirmara sobre las barras estaría midiendo el
 * vacío de jsdom, no el componente — verde siempre, útil nunca.
 *
 * Eso se verifica en el navegador, que es donde hay layout.
 *
 * ── Lo que SÍ se prueba ─────────────────────────────────────────────────────
 *
 * La decisión de qué corte mostrar, que es lógica pura y es donde está la regla
 * del negocio: en un teléfono, treinta barras diarias en 335 px dan 11 px por
 * punto y no se leen. Ahí arranca en SEMANA. En escritorio arranca en DÍA.
 *
 * Y sobre todo: que lo que el usuario elige a mano gane siempre. Un default que
 * pisa una elección explícita es peor que no tener default.
 */

describe('qué corte se muestra', () => {
  it('en teléfono arranca en semana: treinta barras no entran en 335 px', () => {
    expect(elegirGranularidad({ deLaUrl: undefined, pantallaAngosta: true })).toBe('semana')
  })

  it('en escritorio arranca en día', () => {
    expect(elegirGranularidad({ deLaUrl: undefined, pantallaAngosta: false })).toBe('dia')
  })
})

describe('lo que el usuario eligió gana', () => {
  /**
   * El default existe para la primera mirada. Una vez que alguien tocó el
   * conmutador, su elección viaja en la URL y manda — si el ancho la pisara,
   * elegir «Día» en un teléfono sería imposible y el control se vería roto.
   */
  it('la URL le gana al default de teléfono', () => {
    expect(elegirGranularidad({ deLaUrl: 'dia', pantallaAngosta: true })).toBe('dia')
  })

  it('la URL le gana al default de escritorio', () => {
    expect(elegirGranularidad({ deLaUrl: 'mes', pantallaAngosta: false })).toBe('mes')
  })

  /**
   * La URL la escribe cualquiera desde la barra de direcciones. Un valor
   * inventado no puede dejar el gráfico en blanco ni reventar: cae al default,
   * que es la lectura más caritativa de «pediste algo que no existe».
   */
  it('un valor inventado en la URL cae al default, no rompe', () => {
    expect(elegirGranularidad({ deLaUrl: 'quincena', pantallaAngosta: false })).toBe('dia')
    expect(elegirGranularidad({ deLaUrl: '', pantallaAngosta: true })).toBe('semana')
  })
})
