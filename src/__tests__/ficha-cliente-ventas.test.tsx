import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FichaDeClientePage from '@/app/(app)/modulos/clientes/[id]/page'
import type { FichaDeCliente, VentaDelListado } from '@/lib/api-types'
import { ApiError } from '@/lib/errors'

/**
 * Las ventas de UN cliente, en su ficha.
 *
 * ── Por qué el filtro se comprueba acá y no solo en `api/` ──────────────────
 *
 * El error fácil no es que el filtro esté mal en la base: es que esta página
 * pida `/ventas` a secas y descarte en memoria lo que no es del cliente. Eso
 * pasa todos los tests de contenido —las tarjetas que se ven son las suyas— y
 * miente igual, porque lo que llega son las cien últimas del NEGOCIO: un
 * cliente que compró la semana pasada aparecería sin una sola compra.
 *
 * Por eso el test mira la RUTA pedida, no solo lo que se pintó.
 */
vi.mock('@/lib/api-server', () => ({
  getServerUser: vi.fn(async () => ({ name: 'Ana Gómez', roles: ['admin'], permisos: [] })),
  apiServerFetch: vi.fn(),
}))

const { apiServerFetch } = await import('@/lib/api-server')

const CLIENTE_ID = 'c1'

function cliente(sobrescribe: Partial<FichaDeCliente> = {}): FichaDeCliente {
  return {
    id: CLIENTE_ID,
    nombre: 'Yeimy Poveda',
    nombreLibre: null,
    primerNombre: 'Yeimy',
    segundoNombre: null,
    apellidos: 'Poveda',
    apodo: null,
    tipo: 'residencial',
    tipoDocumento: 'CC',
    numeroDocumento: '79123456',
    documento: '79.123.456',
    verificacionEstado: 'verificado',
    verificadoPor: null,
    verificadoEn: null,
    verificacionMetodo: 'admin_oficial',
    creditoHabilitado: true,
    creditoLimite: null,
    activo: true,
    createdAt: '',
    updatedAt: '',
    direcciones: [],
    telefonos: [],
    saldos: { deuda: null, botellones: null, bases: null, cargosPendientes: null },
    ...sobrescribe,
  }
}

function venta(sobrescribe: Partial<VentaDelListado> = {}): VentaDelListado {
  return {
    id: 'v1',
    clienteId: CLIENTE_ID,
    direccionId: 'd1',
    direccionEtiqueta: 'la casa',
    clienteNombre: 'Yeimy Poveda',
    clienteDocumento: 'CC 79.123.456',
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
    createdAt: '2026-09-15T15:00:00.000Z',
    anuladaPor: null,
    anuladaEn: null,
    motivoAnulacion: null,
    corrigeAId: null,
    corregidaPorId: null,
    botellonesEntregados: 0,
    botellonesRecibidos: 0,
    lineas: [
      {
        productoId: 'p1',
        productoNombre: 'Recarga de botellón de 20 L',
        cantidad: 2,
        precioFinal: '10000.00',
        precioManual: false,
      },
    ],
    ...sobrescribe,
  }
}

/** `null` en `ventas` significa **403**: ese rol no ve ventas. */
function responde({ ventas = [] as VentaDelListado[] | null } = {}) {
  vi.mocked(apiServerFetch).mockImplementation((async (ruta: string) => {
    if (ruta.startsWith('/ventas')) {
      if (ventas === null) throw new ApiError(403, 'sin permiso')
      return ventas
    }
    if (ruta.startsWith('/clientes/')) {
      if (ruta.endsWith('/deuda') || ruta.endsWith('/botellones')) {
        throw new ApiError(403, 'sin permiso')
      }
      return cliente()
    }
    if (ruta.startsWith('/geografia')) return []

    /*
     * El catálogo y el stock bajan para poder corregir una venta desde la
     * ficha — RN-VEN-16. Van con el MISMO 403 que las ventas: quien no puede
     * ver ventas tampoco dibuja acciones sobre ellas.
     */
    if (ruta === '/productos' || ruta === '/stock') {
      if (ventas === null) throw new ApiError(403, 'sin permiso')
      return []
    }

    throw new Error(`ruta sin mockear: ${ruta}`)
  }) as never)
}

const pintar = async () =>
  render(await FichaDeClientePage({ params: Promise.resolve({ id: CLIENTE_ID }) }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('la ficha muestra las últimas ventas del cliente', () => {
  it('las pide filtradas por cliente, no la lista entera', async () => {
    responde({ ventas: [venta()] })
    await pintar()

    expect(apiServerFetch).toHaveBeenCalledWith(`/ventas?clienteId=${CLIENTE_ID}`)
  })

  it('pinta las mismas tarjetas que la pantalla de ventas', async () => {
    responde({ ventas: [venta()] })
    await pintar()

    expect(screen.getByRole('heading', { name: 'Últimas ventas' })).toBeInTheDocument()
    expect(screen.getByText('Recarga de botellón de 20 L', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('$20.000')).toBeInTheDocument()
  })

  /*
   * El vacío de esta pantalla NO es el de la pantalla de ventas: acá significa
   * «este cliente todavía no compró», no «el negocio todavía no vendió».
   */
  it('sin ventas lo dice en los términos del cliente', async () => {
    responde({ ventas: [] })
    await pintar()

    expect(screen.getByText('Este cliente todavía no compró')).toBeInTheDocument()
  })

  /*
   * Quien ve un cliente no necesariamente ve las ventas. El 403 esconde la
   * sección entera —no la deja vacía—, igual que los paneles del tablero.
   */
  it('sin permiso de ver ventas, la sección no se dibuja', async () => {
    responde({ ventas: null })
    await pintar()

    expect(screen.queryByRole('heading', { name: 'Últimas ventas' })).not.toBeInTheDocument()
  })
})
