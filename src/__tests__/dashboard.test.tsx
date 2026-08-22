import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/(app)/page'
import type { Producto, ResumenDeStock } from '@/lib/api-types'

vi.mock('@/lib/api-server', () => ({
  getServerUser: vi.fn(async () => ({ name: 'Ana Gómez', roles: ['admin'], permisos: [] })),
  apiServerFetch: vi.fn(),
}))

const { apiServerFetch } = await import('@/lib/api-server')

function stock(sobrescribe: Partial<ResumenDeStock> = {}): ResumenDeStock {
  return {
    productoId: 'p1',
    codigo: 'BOT_20L',
    nombre: 'Recarga de botellón de 20 L',
    activo: true,
    total: 100,
    vendible: 100,
    vencido: 0,
    ...sobrescribe,
  }
}

function producto(sobrescribe: Partial<Producto> = {}): Producto {
  return {
    id: 'p1',
    codigo: 'P20U_600ML',
    nombre: 'Paca de 20 bolsas de 600 ml',
    presentacion: 'paca',
    contenidoMl: 600,
    unidades: 20,
    litros: '12.000',
    precioResidencial: '12000.00',
    precioComercial: '11000.00',
    precioMinimo: '9000.00',
    precioIncluyeImpuestos: true,
    tarifaIvaPorcentaje: '0.00',
    activo: true,
    createdAt: '',
    updatedAt: '',
    ...sobrescribe,
  }
}

/** El dashboard pide stock y productos, en ese orden. */
function responde(stocks: ResumenDeStock[], productos: Producto[]) {
  vi.mocked(apiServerFetch).mockImplementation((async (ruta: string) =>
    ruta.startsWith('/stock') ? stocks : productos) as never)
}

async function pintar() {
  render(await DashboardPage())
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('el dashboard contesta qué hay para hacer', () => {
  it('saluda por el primer nombre, no por el nombre completo', async () => {
    responde([stock()], [producto()])
    await pintar()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hola, Ana')
  })

  /**
   * Un número sin acción al lado es decoración: quien lo lee tiene que salir a
   * buscar dónde arreglarlo, y en el camino se olvida.
   */
  it('cada pendiente lleva al lugar donde se resuelve', async () => {
    responde([stock({ vencido: 7 })], [producto()])
    await pintar()

    const aviso = screen.getByRole('link', { name: /vencido/i })
    expect(aviso).toHaveAttribute('href', '/modulos/stock')
  })

  it('sin nada pendiente no inventa contenido: el sistema no felicita', async () => {
    responde([stock()], [producto()])
    await pintar()

    expect(screen.getByText(/no hay nada esperando/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /vencido/i })).toBeNull()
  })

  it('avisa de productos activos sin unidades para vender', async () => {
    responde([stock({ vendible: 0 })], [producto()])
    await pintar()

    expect(screen.getByText(/sin unidades para vender/i)).toBeInTheDocument()
  })

  it('avisa de productos esperando precio, que el seed dejó desactivados', async () => {
    responde([stock()], [producto({ activo: false, precioResidencial: '0.00' })])
    await pintar()

    const aviso = screen.getByRole('link', { name: /esperando precio/i })
    expect(aviso).toHaveAttribute('href', '/modulos/productos/gestion')
  })

  it('un producto desactivado CON precio no es un pendiente: alguien lo apagó a propósito', async () => {
    responde([stock()], [producto({ activo: false, precioResidencial: '12000.00' })])
    await pintar()

    expect(screen.queryByText(/esperando precio/i)).toBeNull()
  })

  it('concuerda en singular y plural sin el «(s)» que nadie dice hablando', async () => {
    responde([stock({ vencido: 3 })], [producto()])
    await pintar()

    expect(screen.getByText(/1 producto\b/)).toBeInTheDocument()
    expect(screen.queryByText(/producto\(s\)/)).toBeNull()
  })

  it('muestra el inventario aunque no haya nada pendiente', async () => {
    responde([stock()], [producto()])
    await pintar()

    expect(screen.getByText('Recarga de botellón de 20 L')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})
