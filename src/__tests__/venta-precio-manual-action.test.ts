import { afterEach, describe, expect, it, vi } from 'vitest'
import { registrarVentaAction } from '@/app/(app)/modulos/ventas/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')

/**
 * El tramo que ningún otro test tocaba — RN-VEN-15.
 *
 * ── Por qué hace falta un archivo para esto ─────────────────────────────────
 *
 * Los tests del mostrador miran el campo oculto; los de `api/` entran por HTTP
 * con un objeto ya armado. En el medio queda este action, que es donde el
 * carrito deja de ser estado de React y se vuelve un cuerpo JSON — y es
 * exactamente la clase de costura donde un dato se pierde sin que nada se ponga
 * rojo: las dos puntas siguen pasando sus propios tests.
 *
 * Lo que se vigila es que `precioManual` llegue al cuerpo tal como se escribió,
 * y que NO llegue cuando nadie lo escribió: `api/` distingue ausente («cobrá la
 * lista») de presente («cobrá esto»), así que mandar un `''` o un `undefined`
 * explícito no es lo mismo que omitir la clave.
 */

const VENTA_OK = { venta: { total: '11400.00' }, lineas: [], preciosManuales: [] }

const respuesta = (status: number, body: unknown = VENTA_OK): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const form = (items: unknown[], extra: Record<string, string> = {}): FormData => {
  const fd = new FormData()
  fd.set('items', JSON.stringify(items))
  fd.set('medioDePago', 'efectivo')
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

const cuerpoEnviado = (): { items: { precioManual?: string }[] } => {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return JSON.parse(String(init.body))
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('el precio escrito a mano llega al cuerpo', () => {
  it('viaja tal cual, sin reformatear', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201))

    await registrarVentaAction(
      {},
      form([{ productoId: 'p-1', cantidad: 3, precioManual: '3800' }]),
    )

    expect(cuerpoEnviado().items[0]?.precioManual).toBe('3800')
  })

  /**
   * La clave OMITIDA y la clave en `undefined` no son lo mismo del otro lado:
   * Zod ve una y no la otra, y `api/` decide con eso si cobra la lista.
   */
  it('sin precio escrito, la clave ni aparece', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201))

    await registrarVentaAction({}, form([{ productoId: 'p-1', cantidad: 3 }]))

    expect(cuerpoEnviado().items[0]).not.toHaveProperty('precioManual')
  })

  it('convive con la fecha anterior en la misma venta', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201))

    await registrarVentaAction(
      {},
      form([{ productoId: 'p-1', cantidad: 2, precioManual: '3500' }], {
        ocurrioEn: '2026-08-12',
      }),
    )

    const cuerpo = cuerpoEnviado() as { items: unknown[]; ocurrioEn?: string }

    expect(cuerpo.ocurrioEn).toBe('2026-08-12')
    expect(cuerpo.items[0]).toMatchObject({ precioManual: '3500' })
  })
})

describe('la casilla tildada sin número', () => {
  /**
   * Se ataja acá y no en `api/` porque acá todavía se puede decir QUÉ falta. Un
   * `''` contra el esquema vuelve como un 400 que habla de un regex, y quien
   * está en el mostrador no tiene forma de saber que eso significa «escribí el
   * precio o destildá la casilla».
   */
  it('no llama a la API y explica qué hacer', async () => {
    const estado = await registrarVentaAction(
      {},
      form([{ productoId: 'p-1', cantidad: 1, precioManual: '' }]),
    )

    expect(apiServerFetchRaw).not.toHaveBeenCalled()
    expect(estado.error).toMatch(/destilde la casilla/i)
  })
})
