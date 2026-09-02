import { describe, expect, it, vi } from 'vitest'
import { COLUMNAS, columnasVisibles } from '@/components/reportes/columnas'
import type { Extracto, MovimientoDePlata } from '@/lib/api-types'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), getServerUser: vi.fn() }))

const { GET } = await import('@/app/(app)/modulos/reportes/exportar/route')
const { apiServerFetch, getServerUser } = await import('@/lib/api-server')

const movimiento = (extra: Partial<MovimientoDePlata> = {}): MovimientoDePlata => ({
  fecha: '2026-08-12',
  tipo: 'venta',
  contraparte: 'Panadería del Centro',
  monto: '80000.00',
  signo: 1,
  medioDePago: 'efectivo',
  documentoId: 'abc-123',
  detalle: null,
  ...extra,
})

const extracto = (movimientos: MovimientoDePlata[]): Extracto => ({
  desde: '2026-08-01',
  hasta: '2026-08-31',
  movimientos,
  totales: {
    entradas: '0.00',
    salidas: '0.00',
    neto: '0.00',
    porMedioDePago: { efectivo: '0.00', transferencia: '0.00', credito: '0.00' },
    cuadra: true,
  },
})

async function csv(url: string, movimientos = [movimiento()]) {
  vi.mocked(getServerUser).mockResolvedValue({ id: 'u1' } as never)
  vi.mocked(apiServerFetch).mockResolvedValue(extracto(movimientos))

  return (await GET(new Request(url))).text()
}

const URL_BASE = 'http://localhost/modulos/reportes/exportar?desde=2026-08-01&hasta=2026-08-31'

/**
 * ── La selección de columnas — RN-CON-08 ────────────────────────────────────
 *
 * Las columnas se declaran una sola vez y las leen la tabla, el CSV y las
 * casillas. Lo que se prueba acá es que esa lista no se pueda dejar en un
 * estado que produzca un archivo inútil.
 */
describe('qué columnas salen', () => {
  it('sin elegir nada, salen las de siempre', () => {
    expect(columnasVisibles(undefined).map((c) => c.clave)).toEqual([
      'fecha',
      'tipo',
      'contraparte',
      'medioDePago',
      'monto',
    ])
  })

  it('elegidas, sale exactamente eso', () => {
    expect(columnasVisibles('fecha,documentoId').map((c) => c.clave)).toEqual([
      'fecha',
      'monto',
      'documentoId',
    ])
  })

  /*
   * Un extracto sin montos no es un extracto más corto: es una lista de fechas
   * con aspecto de reporte financiero. Y como la regla vive en la función y no
   * en el botón, el CSV tampoco puede salir sin ella.
   */
  it('el monto no se puede quitar, ni destildando todo', () => {
    expect(columnasVisibles('fecha').map((c) => c.clave)).toContain('monto')
    expect(columnasVisibles('').map((c) => c.clave)).toContain('monto')
  })

  it('una columna inventada se ignora, no rompe el archivo', () => {
    expect(columnasVisibles('fecha,inventada').map((c) => c.clave)).toEqual(['fecha', 'monto'])
  })

  it('el orden es el de la declaración, no el de la URL', () => {
    expect(columnasVisibles('monto,fecha').map((c) => c.clave)).toEqual(['fecha', 'monto'])
  })
})

describe('el archivo que se baja', () => {
  it('abre con la fila de encabezados', async () => {
    expect((await csv(URL_BASE)).split('\r\n')[0]).toBe(
      '"Fecha";"Movimiento";"Con quién";"Medio";"Monto"',
    )
  })

  /*
   * ── Sin esto, el contador lo devuelve ─────────────────────────────────────
   *
   * El BOM: sin él, Excel abre el archivo en la codificación del sistema y
   * «Panadería» llega como «PanaderÃ­a».
   *
   * El `;`: en un Excel en español el separador de listas es punto y coma. Con
   * comas, las cinco columnas entran en una sola.
   */
  it('lleva BOM y separa con punto y coma', async () => {
    vi.mocked(getServerUser).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(apiServerFetch).mockResolvedValue(extracto([movimiento()]))

    /*
     * Se miran los BYTES, no el texto: `Response.text()` decodifica con un
     * `TextDecoder`, que se COME el BOM. Verificarlo sobre la cadena daría
     * siempre negativo aunque el archivo esté perfecto — y la reacción sería
     * agregar un segundo BOM para que el test se ponga verde.
     *
     * Lo que le llega a Excel son los bytes.
     */
    const bytes = new Uint8Array(await (await GET(new Request(URL_BASE))).arrayBuffer())

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(await csv(URL_BASE)).toContain('"Panadería del Centro"')
  })

  /*
   * Con punto decimal, `80000.00` entra a Excel como texto o como ochenta
   * millones. Una columna de montos que no se puede sumar no sirve para nada.
   */
  it('el monto lleva coma decimal', async () => {
    expect(await csv(URL_BASE)).toContain('"80000,00"')
  })

  /*
   * El signo va PEGADO al monto. Separarlo en otra columna deja que una hoja de
   * cálculo sume una columna de números todos positivos, y el total daría la
   * plata movida en vez de la ganada.
   */
  it('la salida lleva el menos pegado al número', async () => {
    const texto = await csv(URL_BASE, [movimiento({ tipo: 'compra', signo: -1 })])

    expect(texto).toContain('"-80000,00"')
  })

  /*
   * Un nombre con punto y coma —«Tienda La Esquina; sede norte»— partiría la
   * fila en dos, y el archivo queda desalineado a partir de ahí.
   */
  it('un valor con punto y coma o comillas no parte la fila', async () => {
    const texto = await csv(URL_BASE, [
      movimiento({ contraparte: 'Tienda La Esquina; sede "norte"' }),
    ])

    expect(texto).toContain('"Tienda La Esquina; sede ""norte"""')
    expect(texto.trimEnd().split('\r\n')).toHaveLength(2)
  })

  it('el nombre del archivo dice el rango', async () => {
    vi.mocked(getServerUser).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(apiServerFetch).mockResolvedValue(extracto([movimiento()]))

    const res = await GET(new Request(URL_BASE))

    expect(res.headers.get('content-disposition')).toContain(
      'extracto-2026-08-01-a-2026-08-31.csv',
    )
  })

  /*
   * Esto es una URL: se puede pegar en el navegador. Que solo se llegue desde
   * una pantalla que ya pidió permiso es cosmética — RN-ACC-02.
   */
  it('sin sesión no se baja nada', async () => {
    vi.mocked(getServerUser).mockResolvedValue(null)

    expect((await GET(new Request(URL_BASE))).status).toBe(401)
  })

  it('nunca se cachea: el rango puede haber cambiado desde la última vez', async () => {
    vi.mocked(getServerUser).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(apiServerFetch).mockResolvedValue(extracto([]))

    expect((await GET(new Request(URL_BASE))).headers.get('cache-control')).toBe('no-store')
  })
})

describe('la declaración de columnas', () => {
  it('no hay claves repetidas: dos columnas con la misma clave se pisarían', () => {
    const claves = COLUMNAS.map((c) => c.clave)

    expect(new Set(claves).size).toBe(claves.length)
  })
})
