import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buscarClientesAction,
  buscarClientesAnchoAction,
  direccionesDeClienteAction,
  geografiaAction,
} from '@/app/(app)/modulos/clientes/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetch } = await import('@/lib/api-server')

/**
 * Las consultas bajo demanda de clientes.
 *
 * ── Por qué son Server Actions y no fetch del navegador ─────────────────────
 *
 * Se llaman desde componentes cliente —en cada tecla, algunas—, y aun así el
 * navegador nunca toca `api/`: la acción corre en el servidor y viaja con la
 * cookie de sesión (ADR-0002). Es la única forma de pedir datos bajo demanda
 * sin abrir una segunda puerta a la API.
 *
 * ── La regla que las separa en dos grupos ───────────────────────────────────
 *
 * Las tres que alimentan el mostrador se TRAGAN el error y devuelven vacío:
 * quien está cobrando no puede quedar bloqueado porque una consulta falló. Ve
 * que no aparece nadie y sigue a mano. El error igual queda en el log con su
 * `x-request-id`.
 *
 * `geografiaAction` NO se lo traga, y esa asimetría es deliberada: un
 * desplegable de municipios vacío no se lee como «falló», se lee como «este
 * municipio no existe», y quien carga la dirección elegiría otro.
 */

function urlPedida(n = -1): string {
  return String(vi.mocked(apiServerFetch).mock.calls.at(n)![0])
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('buscarClientesAction() — la del mostrador, por documento', () => {
  it('busca por documento: en el mostrador se dicta una cédula', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await buscarClientesAction('41234567')

    expect(urlPedida()).toBe('/clientes?documento=41234567')
  })

  /*
   * Sin escapar, un término con `&` parte el query string y el resto del
   * documento se pierde como si fuera otro parámetro. Con `#`, todo lo que
   * sigue desaparece.
   */
  it('escapa el término: un & no puede partir el query string', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await buscarClientesAction('41&limite=999')

    expect(urlPedida()).toBe('/clientes?documento=41%26limite%3D999')
  })

  it('devuelve lo que manda api/ sin recortarlo: el tope lo decide api/', async () => {
    const clientes = [{ id: 'cli-1' }, { id: 'cli-2' }, { id: 'cli-3' }]
    vi.mocked(apiServerFetch).mockResolvedValue(clientes)

    expect(await buscarClientesAction('412')).toEqual(clientes)
  })

  it('ante un error devuelve vacío: quien cobra no puede quedar bloqueado', async () => {
    vi.mocked(apiServerFetch).mockRejectedValue(new Error('api caída'))

    expect(await buscarClientesAction('41234567')).toEqual([])
  })
})

/**
 * La búsqueda ANCHA de la pantalla de clientes — M16.
 *
 * La otra busca por documento y con empieza-con. Acá quien busca recuerda un
 * apellido suelto —«el Gómez ese»— o el apodo con el que lo conocen.
 *
 * Antes se filtraba en el navegador y tenía dos defectos medidos: las tildes
 * («gomez» no encontraba a «Gómez», que en Colombia es la mitad de los
 * apellidos) y la escala (obligaba a traer TODOS los clientes en cada carga).
 */
describe('buscarClientesAnchoAction() — la de la pantalla, por lo que sea', () => {
  it('busca con `buscar`, no con `documento`: son dos consultas distintas', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await buscarClientesAnchoAction('Gómez')

    expect(urlPedida()).toContain('buscar=')
    expect(urlPedida()).not.toContain('documento=')
  })

  it('escapa las tildes, que es justo lo que se busca acá', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await buscarClientesAnchoAction('Gómez')

    expect(urlPedida()).toBe('/clientes?buscar=G%C3%B3mez')
  })

  it('escapa el espacio de un nombre compuesto', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await buscarClientesAnchoAction('Doña Rosa')

    expect(urlPedida()).toBe('/clientes?buscar=Do%C3%B1a%20Rosa')
  })

  it('ante un error devuelve vacío, igual que su hermana', async () => {
    vi.mocked(apiServerFetch).mockRejectedValue(new Error('api caída'))

    expect(await buscarClientesAnchoAction('Gómez')).toEqual([])
  })
})

/**
 * Las direcciones de UN cliente, bajo demanda.
 *
 * Reemplaza un N+1: Retornables armaba el desplegable de «a qué dirección»
 * trayéndose las direcciones de TODOS los clientes, una petición por cliente en
 * cada carga. Con mil clientes son mil una peticiones para llenar una lista que
 * además nadie puede recorrer.
 */
describe('direccionesDeClienteAction()', () => {
  it('pide las direcciones de ese cliente y de ninguno más', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await direccionesDeClienteAction('cli-1')

    expect(urlPedida()).toBe('/clientes/cli-1/direcciones')
    expect(vi.mocked(apiServerFetch)).toHaveBeenCalledTimes(1)
  })

  it('devuelve las direcciones tal como vienen', async () => {
    const direcciones = [{ id: 'dir-1' }, { id: 'dir-2' }]
    vi.mocked(apiServerFetch).mockResolvedValue(direcciones)

    expect(await direccionesDeClienteAction('cli-1')).toEqual(direcciones)
  })

  it('ante un error devuelve vacío: se sigue vendiendo sin base', async () => {
    vi.mocked(apiServerFetch).mockRejectedValue(new Error('api caída'))

    expect(await direccionesDeClienteAction('cli-1')).toEqual([])
  })
})

/**
 * El catálogo del DANE, pedido cuando hace falta — M16.
 *
 * El alta en pasos vive en cuatro pantallas: Clientes, el mostrador y las dos
 * de Retornables. Pasarle el catálogo desde cada una significaría que las
 * cuatro carguen 1122 municipios en cada visita, por si alguien registra un
 * cliente — y en el mostrador eso es en cada venta.
 */
describe('geografiaAction()', () => {
  it('trae departamentos y municipios en un solo paso', async () => {
    vi.mocked(apiServerFetch)
      .mockResolvedValueOnce([{ codigo: '20', nombre: 'Cesar' }])
      .mockResolvedValueOnce([{ codigo: '20011', nombre: 'Aguachica' }])

    const { departamentos, municipios } = await geografiaAction()

    expect(departamentos).toEqual([{ codigo: '20', nombre: 'Cesar' }])
    expect(municipios).toEqual([{ codigo: '20011', nombre: 'Aguachica' }])
  })

  it('pide los dos catálogos, no uno solo', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue([])

    await geografiaAction()

    expect(vi.mocked(apiServerFetch)).toHaveBeenCalledTimes(2)
    expect(urlPedida(0)).toBe('/geografia/departamentos')
    expect(urlPedida(1)).toBe('/geografia/municipios')
  })

  /*
   * Acá el error SÍ sube, al revés que en las búsquedas. Un desplegable de
   * municipios vacío no se lee como «falló»: se lee como «este municipio no
   * existe», y quien carga la dirección elegiría otro. Es mejor que la pantalla
   * lo diga.
   */
  it('NO se traga el error: un catálogo vacío se leería como «no existe»', async () => {
    vi.mocked(apiServerFetch).mockRejectedValue(new Error('api caída'))

    await expect(geografiaAction()).rejects.toThrow('api caída')
  })
})
