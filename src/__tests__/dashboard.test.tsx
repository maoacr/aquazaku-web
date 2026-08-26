import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/(app)/page'
import type {
  CierreDeProduccion,
  InsumoListado,
  Producto,
  Reconciliacion,
  ResumenDeStock,
  SaldoDeAgua,
} from '@/lib/api-types'
import { ApiError } from '@/lib/errors'

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

function saldoDeAgua(sobrescribe: Partial<SaldoDeAgua> = {}): SaldoDeAgua {
  return {
    tanque: 'crudo',
    litros: 6500,
    capacidad: 13000,
    nivelCalculado: 'medio',
    ...sobrescribe,
  }
}

/**
 * Qué contesta cada ruta.
 *
 * ── Por qué se enruta por path y no se devuelve lo mismo a todo ─────────────
 *
 * La versión anterior devolvía el catálogo a cualquier ruta que no fuera
 * `/stock`, y funcionaba mientras el tablero pidiera solo dos cosas. Al sumar
 * tanques, producción e insumos, ese mock empezó a entregar productos donde el
 * componente esperaba saldos — y el error que salía era
 * `capacidad is undefined`, que manda a buscar el problema al componente en vez
 * de al mock.
 *
 * `null` significa **403**: ese rol no ve ese panel.
 */
function responde(respuestas: {
  stock?: ResumenDeStock[]
  productos?: Producto[]
  tanques?: SaldoDeAgua[] | null
  produccion?: CierreDeProduccion[] | null
  insumos?: InsumoListado[] | null
  reconciliacion?: Reconciliacion | null
}) {
  vi.mocked(apiServerFetch).mockImplementation((async (ruta: string) => {
    const negar = () => {
      throw new ApiError(403, 'sin permiso')
    }

    if (ruta.startsWith('/stock')) return respuestas.stock ?? []
    if (ruta.startsWith('/productos')) return respuestas.productos ?? []
    if (ruta.startsWith('/tanques/reconciliacion')) {
      return respuestas.reconciliacion === undefined || respuestas.reconciliacion === null
        ? negar()
        : respuestas.reconciliacion
    }
    if (ruta.startsWith('/tanques')) return respuestas.tanques ?? negar()
    if (ruta.startsWith('/produccion')) return respuestas.produccion ?? negar()
    if (ruta.startsWith('/insumos')) return respuestas.insumos ?? negar()

    throw new Error(`ruta sin mockear: ${ruta}`)
  }) as never)
}

async function pintar() {
  render(await DashboardPage())
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('el dashboard contesta qué hay para hacer', () => {
  it('saluda por el primer nombre, no por el nombre completo', async () => {
    responde({ stock: [stock()], productos: [producto()] })
    await pintar()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hola, Ana')
  })

  /**
   * Un número sin acción al lado es decoración: quien lo lee tiene que salir a
   * buscar dónde arreglarlo, y en el camino se olvida.
   */
  it('cada pendiente lleva al lugar donde se resuelve', async () => {
    responde({ stock: [stock({ vencido: 7 })], productos: [producto()] })
    await pintar()

    const aviso = screen.getByRole('link', { name: /vencido/i })
    expect(aviso).toHaveAttribute('href', '/modulos/stock')
  })

  it('sin nada pendiente no inventa contenido: el sistema no felicita', async () => {
    responde({ stock: [stock()], productos: [producto()] })
    await pintar()

    expect(screen.getByText(/no hay nada esperando/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /vencido/i })).toBeNull()
  })

  it('avisa de productos activos sin unidades para vender', async () => {
    responde({ stock: [stock({ vendible: 0 })], productos: [producto()] })
    await pintar()

    expect(screen.getByText(/sin unidades para vender/i)).toBeInTheDocument()
  })

  it('avisa de productos esperando precio, que el seed dejó desactivados', async () => {
    responde({ stock: [stock()], productos: [producto({ activo: false, precioResidencial: '0.00' })] })
    await pintar()

    const aviso = screen.getByRole('link', { name: /esperando precio/i })
    expect(aviso).toHaveAttribute('href', '/modulos/productos/gestion')
  })

  it('un producto desactivado CON precio no es un pendiente: alguien lo apagó a propósito', async () => {
    responde({ stock: [stock()], productos: [producto({ activo: false, precioResidencial: '12000.00' })] })
    await pintar()

    expect(screen.queryByText(/esperando precio/i)).toBeNull()
  })

  it('concuerda en singular y plural sin el «(s)» que nadie dice hablando', async () => {
    responde({ stock: [stock({ vencido: 3 })], productos: [producto()] })
    await pintar()

    expect(screen.getByText(/1 producto\b/)).toBeInTheDocument()
    expect(screen.queryByText(/producto\(s\)/)).toBeNull()
  })

  it('muestra el inventario aunque no haya nada pendiente', async () => {
    responde({ stock: [stock()], productos: [producto()] })
    await pintar()

    expect(screen.getByText('Recarga de botellón de 20 L')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})

/**
 * Los paneles que no todos los roles ven.
 *
 * El `contador` ve la producción pero **no** los tanques; el `seller` no ve
 * ninguno de los dos. El tablero no consulta una copia de la matriz: pide, y el
 * 403 decide. Estos tests fijan las dos mitades de esa decisión.
 */
describe('el tablero compone paneles según lo que el rol puede ver', () => {
  const insumo = (sobrescribe: Partial<InsumoListado> = {}): InsumoListado => ({
    id: 'i1',
    codigo: 'TAPA_20L',
    nombre: 'Tapa para botellón de 20 L',
    unidad: 'unidad',
    minimo: 200,
    saldo: 500,
    equivalenciaPorKilo: null,
    activo: true,
    bajoMinimo: false,
    ...sobrescribe,
  })

  const cierre = (sobrescribe: Partial<CierreDeProduccion> = {}): CierreDeProduccion => ({
    id: 'c1',
    fecha: '2026-08-26',
    minutosProcesando: 120,
    caudalGpm: null,
    litrosProcesados: null,
    pacas600: 10,
    pacas300: 5,
    botellonesLlenados: 30,
    botellonesLavados: 0,
    litrosConsumidos: 795,
    nivelObservado: null,
    registradoPor: null,
    createdAt: '',
    ...sobrescribe,
  })

  it('con permiso, dibuja los dos tanques con sus litros', async () => {
    responde({
      stock: [stock()],
      tanques: [saldoDeAgua(), saldoDeAgua({ tanque: 'procesado', litros: 1000, capacidad: 4000 })],
    })

    await pintar()

    expect(screen.getByText('Agua cruda')).toBeInTheDocument()
    expect(screen.getByText('Agua procesada')).toBeInTheDocument()
    // El SVG dice los números, no la forma: «un dibujo de un tanque» no sirve.
    expect(screen.getByLabelText(/6\.500 de 13\.000 litros, medio/)).toBeInTheDocument()
  })

  /**
   * ── El caso que justifica que exista `siPuedeVerlo` ──────────────────────
   *
   * Sin él, pedir `/tanques` como `seller` lanza y la página entera se cae con
   * un 500 — por un panel que ni siquiera correspondía mostrar.
   */
  it('sin permiso NO se cae: el panel simplemente no está', async () => {
    responde({ stock: [stock()], tanques: null, produccion: null, insumos: null })

    await pintar()

    expect(screen.queryByText('El agua')).not.toBeInTheDocument()
    expect(screen.queryByText('Producción')).not.toBeInTheDocument()
    // Y lo que sí corresponde sigue estando.
    expect(screen.getByText('Inventario')).toBeInTheDocument()
  })

  it('un saldo de agua negativo es un pendiente, no un tanque vacío', async () => {
    responde({ stock: [stock()], tanques: [saldoDeAgua({ litros: -909 })] })

    await pintar()

    expect(screen.getByText('El libro del agua quedó corto')).toBeInTheDocument()
    expect(screen.getByLabelText(/libro quedó corto en 909 litros/)).toBeInTheDocument()
  })

  /**
   * `litrosProcesados` es `null` mientras nadie mida el caudal (pregunta 4).
   * Dibujarlo en cero diría «ese día no se procesó nada», que es otra cosa.
   */
  it('un día sin caudal medido no se cuenta como cero', async () => {
    responde({ stock: [stock()], produccion: [cierre()] })

    await pintar()

    expect(screen.getByLabelText(/no tiene el caudal medido/)).toBeInTheDocument()
  })

  it('los insumos se miden contra su mínimo, con el estado en cuatro canales', async () => {
    responde({
      stock: [stock()],
      insumos: [insumo({ saldo: 40, bajoMinimo: true })],
    })

    await pintar()

    expect(screen.getByLabelText(/40 unidades, mínimo 200\. Hay que pedir/)).toBeInTheDocument()
    // El texto de la insignia es el cuarto canal: sin color, se sigue leyendo.
    expect(screen.getByText('Hay que pedir')).toBeInTheDocument()
  })

  /**
   * La franja del nivel observado es lo que hace que el dibujo del tanque sea
   * comparable con la realidad en vez de decorativo.
   */
  it('cuando el libro no cuadra con lo que se vio, lo dice y lo lleva a resolverlo', async () => {
    responde({
      stock: [stock()],
      tanques: [saldoDeAgua({ litros: 2000, nivelCalculado: 'un_cuarto' })],
      produccion: [cierre({ nivelObservado: 'medio' })],
      reconciliacion: {
        tanque: 'crudo',
        litrosCalculados: 2000,
        nivelCalculado: 'un_cuarto',
        nivelObservado: 'medio',
        banda: { nivel: 'medio', desde: 4875, hasta: 8125 },
        cuadra: false,
        ajusteSugerido: 4500,
      },
    })

    await pintar()

    expect(screen.getByText('El tanque crudo no cuadra con lo que se vio')).toBeInTheDocument()
    expect(screen.getByLabelText(/No coincide con el nivel observado, que fue medio/)).toBeInTheDocument()
  })
})
