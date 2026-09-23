import { afterEach, describe, expect, it, vi } from 'vitest'
import { corregirVentaAction, registrarVentaAction } from '@/app/(app)/modulos/ventas/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')

/**
 * La dirección de entrega llega al cuerpo — RN-VEN-18.
 *
 * ── Por qué acá y no en el mostrador ni en `api/` ───────────────────────────
 *
 * Los tests del mostrador miran que el desplegable se dibuje; los de `api/`
 * entran con un objeto ya armado. En el medio está este action, que es donde el
 * `FormData` se vuelve JSON — y es justo la costura donde un campo se pierde
 * sin que nada se ponga rojo, porque las dos puntas siguen pasando sus propios
 * tests. Ya pasó con `precioManual`, y por eso existe el archivo de al lado.
 *
 * ── Las dos puntas de la regla ──────────────────────────────────────────────
 *
 * Con cliente, la dirección viaja. Sin cliente NO viaja ninguna: una dirección
 * cuelga de un cliente (RN-CLI-07), y `api/` rechaza el par suelto con
 * `DIRECCION_SIN_CLIENTE`. Mandarla igual convertiría ese rechazo en un error
 * que quien atiende no puede explicar.
 */

const VENTA_OK = { venta: { total: '11400.00' }, lineas: [], preciosManuales: [] }
const CORRECCION_OK = {
  venta: { id: 'v2', total: '11400.00' },
  reemplazada: { id: 'v1', total: '11400.00' },
  lineas: [],
  preciosManuales: [],
}

const respuesta = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 201, headers: { 'content-type': 'application/json' } })

const form = (extra: Record<string, string> = {}): FormData => {
  const fd = new FormData()
  fd.set('items', JSON.stringify([{ productoId: 'p-1', cantidad: 2 }]))
  fd.set('medioDePago', 'efectivo')
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

const cuerpoEnviado = (): Record<string, unknown> => {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return JSON.parse(String(init.body))
}

afterEach(() => vi.mocked(apiServerFetchRaw).mockReset())

describe('el alta', () => {
  it('manda la dirección cuando hay cliente', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(VENTA_OK))

    await registrarVentaAction({}, form({ clienteId: 'c-1', direccionId: 'd-1' }))

    expect(cuerpoEnviado()).toMatchObject({ clienteId: 'c-1', direccionId: 'd-1' })
  })

  it('sin cliente no manda dirección, aunque el campo venga con algo', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(VENTA_OK))

    await registrarVentaAction({}, form({ direccionId: 'd-1' }))

    const cuerpo = cuerpoEnviado()
    expect(cuerpo).not.toHaveProperty('clienteId')
    expect(cuerpo).not.toHaveProperty('direccionId')
  })

  /*
   * Son dos campos distintos y se mandan por separado. `baseDireccionId` dice
   * dónde se reclama una base prestada (RN-BAS-03); `direccionId` dice a dónde
   * va la venta. Suelen coincidir, y por eso es fácil escribir el código que
   * los confunde.
   */
  it('la dirección de la venta no pisa la de la base', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(VENTA_OK))

    await registrarVentaAction(
      {},
      form({
        clienteId: 'c-1',
        direccionId: 'd-1',
        baseSticker: '0042',
        baseDireccionId: 'd-2',
      }),
    )

    expect(cuerpoEnviado()).toMatchObject({
      direccionId: 'd-1',
      base: { sticker: '0042', direccionId: 'd-2' },
    })
  })
})

/*
 * La corrección puede CAMBIAR el cliente, y entonces la dirección tiene que ser
 * del cliente nuevo — lo exige la foránea compuesta de `api/`. Sin este campo
 * en el cuerpo, corregir el cliente rebotaría contra la base.
 */
describe('la corrección', () => {
  it('manda la dirección junto con el cliente', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(CORRECCION_OK))

    await corregirVentaAction(
      {},
      form({
        ventaId: 'v-1',
        clienteId: 'c-2',
        direccionId: 'd-9',
        motivo: 'el cliente estaba equivocado en el registro original',
      }),
    )

    expect(cuerpoEnviado()).toMatchObject({ clienteId: 'c-2', direccionId: 'd-9' })
  })
})
