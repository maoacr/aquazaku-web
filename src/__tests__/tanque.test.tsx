import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tanque } from '@/components/graficos/tanque'
import type { SaldoDeAgua } from '@/lib/api-types'

/**
 * El dibujo del tanque.
 *
 * Lo que se prueba no es la geometría —los números del `viewBox` son una
 * decisión estética y cambiarlos no debería poner nada en rojo— sino que el
 * dibujo **no diga cosas que no son**: que no pinte agua donde no hay, que un
 * saldo negativo no se vea como un tanque vacío, y que lo que escucha un lector
 * de pantalla sean los números y no la forma.
 */

function saldo(sobrescribe: Partial<SaldoDeAgua> = {}): SaldoDeAgua {
  return {
    tanque: 'crudo',
    litros: 6500,
    capacidad: 13000,
    nivelCalculado: 'medio',
    ...sobrescribe,
  }
}

/** El agua es lo único que se pinta con la clase del agua. */
const agua = (c: HTMLElement) => c.querySelectorAll('.fill-agua')

describe('el tanque dibuja lo que hay', () => {
  it('con agua, la pinta', () => {
    const { container } = render(<Tanque saldo={saldo()} id="t" />)

    expect(agua(container).length).toBeGreaterThan(0)
  })

  /**
   * Un tanque vacío no lleva una lámina de un pixel abajo: lleva nada. Pintar
   * una línea sugiere que queda algo.
   */
  it('vacío no pinta una lámina de un pixel', () => {
    const { container } = render(<Tanque saldo={saldo({ litros: 0, nivelCalculado: 'vacio' })} id="t" />)

    expect(agua(container)).toHaveLength(0)
  })

  /**
   * ── El caso que da sentido a distinguir cero de negativo ─────────────────
   *
   * Un saldo negativo NO es un tanque vacío: es un libro al que se le perdió
   * una entrada. Dibujarlo vacío diría que no hay agua, que es otra cosa —
   * pasa de forma esperable porque el ingreso de la red se registra sin
   * cantidad (RN-PRD-11).
   */
  it('negativo lo dice, en vez de verse vacío', () => {
    const { container, getByLabelText } = render(
      <Tanque saldo={saldo({ litros: -909, nivelCalculado: 'vacio' })} id="t" />,
    )

    expect(agua(container)).toHaveLength(0)
    expect(container.textContent).toContain('libro corto')
    expect(getByLabelText(/libro quedó corto en 909 litros/)).toBeInTheDocument()
  })

  it('lo que escucha un lector de pantalla son los números, no la forma', () => {
    const { getByLabelText } = render(<Tanque saldo={saldo()} id="t" />)

    expect(getByLabelText('6.500 de 13.000 litros, medio.')).toBeInTheDocument()
  })

  describe('la franja del nivel observado', () => {
    const banda = { nivel: 'medio' as const, desde: 4875, hasta: 8125 }

    it('cuando el libro cae adentro, lo dice', () => {
      const { getByLabelText } = render(<Tanque saldo={saldo()} banda={banda} id="t" />)

      expect(getByLabelText(/Coincide con el nivel observado: medio/)).toBeInTheDocument()
    })

    it('cuando cae afuera, también', () => {
      const { getByLabelText } = render(
        <Tanque saldo={saldo({ litros: 2000, nivelCalculado: 'un_cuarto' })} banda={banda} id="t" />,
      )

      expect(getByLabelText(/No coincide con el nivel observado, que fue medio/)).toBeInTheDocument()
    })
  })

  /**
   * Dos tanques en la misma página comparten el documento. Con el mismo `id`
   * de `clipPath`, el segundo se roba el recorte del primero y el agua se
   * dibuja recortada por la silueta equivocada.
   */
  it('cada tanque usa su propio recorte', () => {
    const { container } = render(
      <>
        <Tanque saldo={saldo()} id="crudo" />
        <Tanque saldo={saldo({ tanque: 'procesado', capacidad: 4000, litros: 1000 })} id="procesado" />
      </>,
    )

    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
