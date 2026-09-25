import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorregirLaVenta } from '@/components/clientes/corregir-la-venta'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/seguimientos/actions', () => ({
  ventaParaCorregirAction: vi.fn(),
}))

const { ventaParaCorregirAction } = await import('@/app/(app)/modulos/seguimientos/actions')

/**
 * El lápiz de Seguimientos — M15.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que el modal **monte el mostrador de verdad**. La primera versión traía un
 * diálogo propio con un `<select>` de direcciones, y enchufar el mostrador en
 * su lugar es la clase de cambio donde una prop que falta no rompe el
 * typecheck —porque el componente la recibe igual— pero revienta al abrirse.
 *
 * Por eso se hace clic. Un test que solo renderice el botón pasaría con el
 * modal roto adentro.
 */

const VENTA: VentaDelListado = {
  id: 'v1',
  clienteId: 'c1',
  clienteNombre: 'Yeimy Padilla',
  clienteDocumento: '79123456',
  registradoPorNombre: 'Ana',
  medioDePago: 'efectivo',
  total: '30000.00',
  createdAt: '2026-08-26T17:30:00.000Z',
  estado: 'confirmada',
  tipo: 'producto',
  direccionId: null,
  direccionEtiqueta: null,
  botellonesEntregados: 3,
  botellonesRecibidos: 2,
  requiereFacturaElectronica: false,
  tipoClienteAlMomento: 'residencial',
  lineas: [
    {
      productoId: 'p1',
      productoNombre: 'Recarga de botellón de 20 L',
      cantidad: 3,
      precioFinal: '10000.00',
      precioManual: false,
    },
  ],
} as unknown as VentaDelListado

const productos: Producto[] = [
  {
    id: 'p1',
    codigo: 'BOT_20L',
    nombre: 'Recarga de botellón de 20 L',
    presentacion: 'botellon',
    activo: true,
    precioResidencial: '10000.00',
    precioComercial: '9000.00',
    precioMinimo: '8000.00',
  } as unknown as Producto,
]

const stock: ResumenDeStock[] = [
  {
    productoId: 'p1',
    codigo: 'BOT_20L',
    nombre: 'Recarga de botellón de 20 L',
    activo: true,
    total: 100,
    vendible: 100,
    vencido: 0,
  },
]

const pintar = (sinDireccion = true) =>
  render(
    <CorregirLaVenta
      ventaId="v1"
      nombre="Yeimy Padilla"
      sinDireccion={sinDireccion}
      productos={productos}
      stock={stock}
    />,
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ventaParaCorregirAction).mockResolvedValue(VENTA)
})

describe('el botón', () => {
  it('se nombra según lo que va a hacer en ESTA fila', () => {
    const { unmount } = pintar(true)
    expect(screen.getByRole('button', { name: /Asignarle la dirección/ })).toBeInTheDocument()
    unmount()

    pintar(false)
    expect(screen.getByRole('button', { name: /Corregir la venta/ })).toBeInTheDocument()
  })

  it('no pide la venta hasta que alguien lo toca', () => {
    pintar()

    /*
     * Cuarenta filas pidiendo cuarenta ventas con sus líneas para que alguien
     * corrija una sería pagar la pantalla entera por adelantado.
     */
    expect(ventaParaCorregirAction).not.toHaveBeenCalled()
  })
})

describe('al abrirlo', () => {
  it('pide la venta y monta el mostrador precargado', async () => {
    pintar()

    await userEvent.click(screen.getByRole('button', { name: /Asignarle la dirección/ }))

    expect(ventaParaCorregirAction).toHaveBeenCalledWith('v1')

    /*
     * La prueba de que el mostrador montó: su selector de dirección. Es lo que
     * esta fila viene a completar, y si el modal se rompiera al abrirse, esto
     * no existiría.
     */
    await waitFor(() => {
      expect(screen.getByText(/Asignarle la dirección a la venta/)).toBeInTheDocument()
    })
    expect(await screen.findByRole('combobox', { name: /dirección/i })).toBeInTheDocument()
  })

  it('explica que el conteo es del cliente, no de una puerta', async () => {
    pintar()

    await userEvent.click(screen.getByRole('button', { name: /Asignarle la dirección/ }))

    expect(
      await screen.findByText(/su conteo de días es del cliente y no de una puerta/),
    ).toBeInTheDocument()
  })

  it('en una fila que ya tiene dirección, no explica nada de eso', async () => {
    pintar(false)

    await userEvent.click(screen.getByRole('button', { name: /Corregir la venta/ }))

    await waitFor(() => expect(ventaParaCorregirAction).toHaveBeenCalled())
    expect(screen.queryByText(/no de una puerta/)).not.toBeInTheDocument()
  })

  it('la segunda apertura no vuelve a pedir la venta', async () => {
    pintar()
    const boton = screen.getByRole('button', { name: /Asignarle la dirección/ })

    await userEvent.click(boton)
    await waitFor(() => expect(ventaParaCorregirAction).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: /Cerrar|Cancelar/i }))
    await userEvent.click(boton)

    expect(ventaParaCorregirAction).toHaveBeenCalledTimes(1)
  })
})
