import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListaDeAbonos } from '@/components/ventas/abonos'
import type { Cobro } from '@/lib/api-types'

/**
 * El libro de abonos de un cliente — RN-VEN-07.
 *
 * ── Lo que se vigila ────────────────────────────────────────────────────────
 *
 * Que sin abonos lo DIGA en vez de dejar un hueco. Una lista vacía y una lista
 * que no cargó se ven igual, y la conclusión es la opuesta: «no pagó nada»
 * contra «no sabemos».
 *
 * Y que cada abono muestre las tres cosas con las que se cuadra una caja: el
 * monto, el medio y cuándo. Con la hora y no solo el día — dos abonos del mismo
 * cliente en una misma jornada se distinguen por ahí.
 */

const cobro = (extra: Partial<Cobro> = {}): Cobro => ({
  id: 'cob-1',
  clienteId: 'cli-1',
  monto: '20000.00',
  medioDePago: 'efectivo',
  observaciones: null,
  registradoPor: 'usr-1',
  createdAt: '2026-09-20T15:30:00Z',
  ...extra,
})

describe('el libro de abonos', () => {
  it('sin abonos, lo dice en vez de dejar un hueco', () => {
    render(<ListaDeAbonos cobros={[]} />)

    expect(screen.getByText(/todavía no hay abonos/i)).toBeInTheDocument()
  })

  it('cada abono muestra el monto, el medio y la fecha', () => {
    render(<ListaDeAbonos cobros={[cobro()]} />)

    expect(screen.getByText(/\$20.000/)).toBeInTheDocument()
    expect(screen.getByText(/efectivo/i)).toBeInTheDocument()
    expect(screen.getByText(/20\/09\/26/)).toBeInTheDocument()
  })

  it('las observaciones se muestran cuando están', () => {
    render(<ListaDeAbonos cobros={[cobro({ observaciones: 'pagó en la tienda' })]} />)

    expect(screen.getByText(/pagó en la tienda/i)).toBeInTheDocument()
  })
})
