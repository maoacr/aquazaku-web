import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UltimasVentas } from '@/components/ventas/ultimas-ventas'
import type { VentaDelListado } from '@/lib/api-types'

/**
 * La misma lista, mirada desde dos lados.
 *
 * ── La jerarquía la fija el CONTEXTO, no la tarjeta ─────────────────────────
 *
 * Arriba de cada tarjeta va el dato que distingue una venta de otra, y ese dato
 * cambia según dónde se esté parado:
 *
 * · en la pantalla de ventas, veinte tarjetas son de veinte personas: distingue
 *   **a quién**;
 * · en la ficha de un cliente, las veinte son de la misma persona. El nombre
 *   repetido veinte veces no distingue nada —es ruido con el peso tipográfico
 *   de un título— y lo que distingue pasa a ser **cuándo**.
 */
const CREADA = '2026-09-15T20:00:00.000Z'
const CUANDO = '15/09/26, 3:00 p. m.'

function venta(sobrescribe: Partial<VentaDelListado> = {}): VentaDelListado {
  return {
    id: 'v1',
    clienteId: 'c1',
    clienteNombre: 'Yeimy Poveda',
    tipoClienteAlMomento: 'residencial',
    medioDePago: 'efectivo',
    canal: 'mostrador',
    tipo: 'producto',
    estado: 'confirmada',
    total: '20000.00',
    codigoDescuentoId: null,
    requiereFacturaElectronica: false,
    registradoPor: 'u1',
    registradoPorNombre: 'Ana Gómez',
    createdAt: CREADA,
    anuladaPor: null,
    anuladaEn: null,
    motivoAnulacion: null,
    lineas: [{ productoNombre: 'Recarga de botellón de 20 L', cantidad: 2 }],
    ...sobrescribe,
  }
}

const titulo = () => screen.getByRole('heading', { level: 3 }).textContent

describe('en la pantalla de ventas, arriba va a QUIÉN', () => {
  it('el título de la tarjeta es el nombre del cliente', () => {
    render(<UltimasVentas ventas={[venta()]} />)

    expect(titulo()).toBe('Yeimy Poveda')
  })

  it('y la fecha va en el pie, con el canal y quién la cargó', () => {
    render(<UltimasVentas ventas={[venta()]} />)

    expect(screen.getByText(new RegExp(`^${CUANDO} · Mostrador · Ana Gómez$`))).toBeInTheDocument()
  })

  it('el vacío habla del negocio', () => {
    render(<UltimasVentas ventas={[]} />)

    expect(screen.getByText('Todavía no hay ventas')).toBeInTheDocument()
  })
})

describe('en la ficha del cliente, arriba va CUÁNDO', () => {
  const enLaFicha = (ventas: VentaDelListado[]) =>
    render(<UltimasVentas ventas={ventas} desde="la-ficha-del-cliente" />)

  it('el nombre del cliente no se repite en cada tarjeta', () => {
    enLaFicha([venta(), venta({ id: 'v2' })])

    expect(screen.queryByText('Yeimy Poveda')).not.toBeInTheDocument()
  })

  it('el título de la tarjeta es la fecha y la hora', () => {
    enLaFicha([venta()])

    expect(titulo()).toBe(CUANDO)
  })

  /*
   * Subirla al título y dejarla también en el pie sería escribir el mismo dato
   * dos veces en cuatro centímetros de tarjeta.
   */
  it('y entonces el pie ya no la repite', () => {
    enLaFicha([venta()])

    expect(screen.getByText('Mostrador · Ana Gómez')).toBeInTheDocument()
  })

  it('lo que salió y la plata siguen estando', () => {
    enLaFicha([venta()])

    expect(screen.getByText(/Recarga de botellón de 20 L/)).toBeInTheDocument()
    expect(screen.getByText('$20.000')).toBeInTheDocument()
  })

  it('el vacío habla del cliente, no del negocio', () => {
    enLaFicha([])

    expect(screen.getByText('Este cliente todavía no compró')).toBeInTheDocument()
  })
})
