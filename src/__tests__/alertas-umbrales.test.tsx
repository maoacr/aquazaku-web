import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Umbrales } from '@/components/alertas/umbrales'
import type { Parametro } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/alertas/actions', () => ({ cambiarUmbralAction: vi.fn() }))

/**
 * La pantalla de umbrales — M12, RN-STK-11.
 *
 * ── Lo que se prueba es que la pantalla NO sabe nada ────────────────────────
 *
 * Etiqueta, ayuda, unidad y límites vienen del servidor. Un parámetro nuevo
 * tiene que aparecer acá con solo agregarlo en una migración: sin tocar `web`,
 * sin desplegar el frontend.
 */

const parametro = (extra: Partial<Parametro> = {}): Parametro => ({
  clave: 'dias_aviso_vencimiento',
  valor: 7,
  minimo: 1,
  maximo: 30,
  etiqueta: 'Aviso de vencimiento',
  ayuda: 'Con cuántos días de anticipación se marca un lote como «vence pronto».',
  unidad: 'días',
  actualizadoEn: '2026-09-07T00:00:00Z',
  ...extra,
})

describe('la pantalla dibuja lo que el servidor manda', () => {
  it('muestra la etiqueta y la ayuda que vinieron, sin copiarlas', () => {
    render(<Umbrales parametros={[parametro({ etiqueta: 'Un umbral inventado' })]} />)

    expect(screen.getByRole('heading', { name: 'Un umbral inventado' })).toBeInTheDocument()
    expect(screen.getByText(/vence pronto/)).toBeInTheDocument()
  })

  /*
   * Los límites del campo salen de la fila. Copiarlos sería un tercer lugar con
   * los mismos números —el CHECK, la fila y este componente— y el día que
   * cambien, dos discreparían en silencio.
   */
  it('los límites del campo salen del parámetro, no de una constante', () => {
    render(<Umbrales parametros={[parametro({ minimo: 3, maximo: 45 })]} />)

    const campo = screen.getByRole('spinbutton')

    expect(campo).toHaveAttribute('min', '3')
    expect(campo).toHaveAttribute('max', '45')
    expect(campo).toHaveValue(7)
  })

  it('un parámetro que el código no conoce se dibuja igual', () => {
    render(
      <Umbrales
        parametros={[
          parametro({ clave: 'algo_que_no_existe_hoy', etiqueta: 'Futuro', unidad: 'horas' }),
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Futuro' })).toBeInTheDocument()
    expect(screen.getByText(/horas/)).toBeInTheDocument()
  })

  it('cada umbral es su propio formulario: guardar uno no toca los otros', () => {
    render(
      <Umbrales
        parametros={[parametro(), parametro({ clave: 'dias_entrega_bases', etiqueta: 'Demora' })]}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Guardar' })).toHaveLength(2)
  })
})
