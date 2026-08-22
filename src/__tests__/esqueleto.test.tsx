import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EsqueletoDeTabla } from '@/components/ui/esqueleto'

/**
 * R49 · La carga muestra la forma de lo que viene.
 *
 * Un esqueleto que no copia la grilla real vuelve a producir el salto que R49
 * quiere evitar: si dibuja tres columnas y llegan siete, todo se corre cuando
 * llegan los datos. En un punto de venta ese salto se paga en clics
 * equivocados — alguien apunta a un botón que todavía no está donde va a estar.
 */
describe('R49 · el esqueleto copia la grilla real', () => {
  it('dibuja exactamente las columnas que se le piden', () => {
    const { container } = render(<EsqueletoDeTabla columnas={7} filas={3} />)

    const filas = container.querySelectorAll('.border-t')
    expect(filas).toHaveLength(3)
    expect(filas[0]!.children).toHaveLength(7)
  })

  /**
   * En una tabla real las columnas son desparejas —un código es corto y un
   * nombre es largo—. Todas iguales se lee como una grilla de ladrillos, que no
   * se parece a ninguna tabla.
   */
  it('respeta anchos distintos por columna', () => {
    const { container } = render(
      <EsqueletoDeTabla columnas={3} filas={1} anchos={['w-40', 'w-16', 'w-24']} />,
    )

    const celdas = [...container.querySelectorAll('.border-t')[0]!.children]
    expect(celdas.map((c) => [...c.classList].find((k) => k.startsWith('w-')))).toEqual([
      'w-40',
      'w-16',
      'w-24',
    ])
  })

  /**
   * El esqueleto se anuncia UNA vez, no doce.
   *
   * Cada rectángulo va `aria-hidden`: son andamio visual y no hay nada que
   * leerle a nadie. Quien usa lector de pantalla se entera por el `aria-busy` de
   * la región, no por una lista de rectángulos.
   */
  it('se anuncia una sola vez y no rectángulo por rectángulo', () => {
    const { container } = render(<EsqueletoDeTabla columnas={4} filas={5} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument()

    // Los 20 rectángulos más el del encabezado, todos ocultos al lector.
    const rectangulos = container.querySelectorAll('[aria-hidden]')
    expect(rectangulos.length).toBeGreaterThan(20)
  })

  /**
   * Una animación que late sin parar es exactamente lo que molesta a quien pidió
   * menos movimiento — y el esqueleto se entiende igual quieto.
   */
  it('la animación se apaga con `prefers-reduced-motion`', () => {
    const { container } = render(<EsqueletoDeTabla columnas={2} filas={1} />)

    const rectangulo = container.querySelector('[aria-hidden]')!
    expect(rectangulo.className).toContain('motion-reduce:animate-none')
  })
})
