import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cambiarEstadoAction,
  crearProveedorAction,
  marcarPagadaAction,
  registrarCompraAction,
} from '@/app/(app)/modulos/proveedores/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Compras y proveedores — M9.
 *
 * ── Las dos reglas que más duelen si se rompen ──────────────────────────────
 *
 * El vencimiento viaja SOLO a crédito. Una compra de contado con `venceEl`
 * encima la rechaza `api/`, y con razón: no hay nada que venza en algo que ya
 * se pagó.
 *
 * Y reactivar un proveedor existe por el caso real —«le volvimos a comprar»—.
 * Sin eso, el camino que encuentra quien atiende es crear un duplicado con el
 * mismo NIT, y el historial de compras queda partido en dos.
 */

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function respondeSiempre(status: number, body: unknown = {}): void {
  vi.mocked(apiServerFetchRaw).mockImplementation(async () => respuesta(status, body))
}

function ultimoPedido(): { url: string; metodo: string; body: Record<string, unknown> } {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return {
    url: llamada[0],
    metodo: String(init.method),
    body: init.body ? JSON.parse(String(init.body)) : {},
  }
}

const LINEAS = JSON.stringify([{ insumoId: 'ins-1', cantidad: 10, costoUnitario: 1200 }])

afterEach(() => {
  vi.clearAllMocks()
})

describe('crearProveedorAction()', () => {
  it('va por POST a la colección de proveedores', async () => {
    respondeSiempre(201, { nombre: 'Distribuidora del Norte' })

    await crearProveedorAction({}, form({ nombre: 'Distribuidora del Norte' }))

    expect(ultimoPedido().url).toBe('/proveedores')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  /*
   * El NIT y el contacto son opcionales a propósito (RN-PRO-01): al que vende
   * bidones en la esquina se le compra igual. Mandarlos vacíos los guardaría
   * como cadena en blanco, y después «tiene NIT» sería cierto y falso a la vez.
   */
  it('sin NIT ni contacto no manda las claves: son opcionales, no vacías', async () => {
    respondeSiempre(201, { nombre: 'El de la esquina' })

    await crearProveedorAction({}, form({ nombre: 'El de la esquina', nit: '', contacto: '' }))

    const { body } = ultimoPedido()
    expect(body).toEqual({ nombre: 'El de la esquina' })
  })

  it('con NIT y contacto los manda recortados', async () => {
    respondeSiempre(201, { nombre: 'Distribuidora del Norte' })

    await crearProveedorAction(
      {},
      form({ nombre: 'Distribuidora del Norte', nit: '  900123456-1 ', contacto: ' Ana ' }),
    )

    expect(ultimoPedido().body).toMatchObject({ nit: '900123456-1', contacto: 'Ana' })
  })

  it('el mensaje nombra al proveedor que devolvió api/', async () => {
    respondeSiempre(201, { nombre: 'Distribuidora del Norte' })

    const estado = await crearProveedorAction({}, form({ nombre: 'distribuidora del norte' }))

    expect(estado.ok).toBe('Distribuidora del Norte quedó cargado.')
  })

  it('refresca la pantalla de proveedores', async () => {
    respondeSiempre(201, { nombre: 'X' })

    await crearProveedorAction({}, form({ nombre: 'X' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/proveedores')
  })
})

describe('cambiarEstadoAction()', () => {
  it('va por PATCH al estado del proveedor', async () => {
    respondeSiempre(200, { nombre: 'Distribuidora del Norte' })

    await cambiarEstadoAction({}, form({ proveedorId: 'prv-1', activo: 'no' }))

    expect(ultimoPedido().url).toBe('/proveedores/prv-1/estado')
    expect(ultimoPedido().metodo).toBe('PATCH')
  })

  it('el «si» activa y cualquier otra cosa desactiva', async () => {
    respondeSiempre(200, { nombre: 'X' })

    await cambiarEstadoAction({}, form({ proveedorId: 'prv-1', activo: 'si' }))
    expect(ultimoPedido().body).toEqual({ activo: true })

    await cambiarEstadoAction({}, form({ proveedorId: 'prv-1', activo: 'no' }))
    expect(ultimoPedido().body).toEqual({ activo: false })
  })

  it('el mensaje dice en qué estado quedó, no qué se pidió', async () => {
    respondeSiempre(200, { nombre: 'Distribuidora del Norte' })

    const activado = await cambiarEstadoAction({}, form({ proveedorId: 'prv-1', activo: 'si' }))
    expect(activado.ok).toBe('Distribuidora del Norte quedó activo.')

    const bajado = await cambiarEstadoAction({}, form({ proveedorId: 'prv-1', activo: 'no' }))
    expect(bajado.ok).toBe('Distribuidora del Norte quedó desactivado.')
  })
})

/**
 * Registrar una compra — RN-PRO-05.
 *
 * Las líneas llegan como JSON en un campo oculto, igual que el carrito de una
 * venta: son una lista de largo variable y un formulario plano no la expresa.
 */
describe('registrarCompraAction()', () => {
  const COMPRA_PAGADA = { compra: { total: '12.000', pagada: true, venceEl: null } }
  const COMPRA_A_CREDITO = { compra: { total: '12.000', pagada: false, venceEl: '2026-10-18' } }

  it('va por POST a compras', async () => {
    respondeSiempre(201, COMPRA_PAGADA)

    await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(ultimoPedido().url).toBe('/compras')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('las líneas viajan como lista, no como el texto del campo oculto', async () => {
    respondeSiempre(201, COMPRA_PAGADA)

    await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(ultimoPedido().body.lineas).toEqual([
      { insumoId: 'ins-1', cantidad: 10, costoUnitario: 1200 },
    ])
  })

  it('sin líneas manda una lista vacía, no rompe el JSON', async () => {
    respondeSiempre(201, COMPRA_PAGADA)

    await registrarCompraAction({}, form({ proveedorId: 'prv-1' }))

    expect(ultimoPedido().body.lineas).toEqual([])
  })

  it('sin medio de pago elegido asume efectivo', async () => {
    respondeSiempre(201, COMPRA_PAGADA)

    await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(ultimoPedido().body.medioDePago).toBe('efectivo')
  })

  describe('el vencimiento viaja solo a crédito', () => {
    it('a crédito y con fecha, viaja', async () => {
      respondeSiempre(201, COMPRA_A_CREDITO)

      await registrarCompraAction(
        {},
        form({
          proveedorId: 'prv-1',
          lineas: LINEAS,
          medioDePago: 'credito',
          venceEl: '2026-10-18',
        }),
      )

      expect(ultimoPedido().body.venceEl).toBe('2026-10-18')
    })

    /*
     * De contado no hay nada que venza. Si la fecha se colara, `api/` rechaza
     * la compra entera y quien la está cargando pierde el trabajo por un campo
     * que ni siquiera eligió.
     */
    it('de contado NO viaja aunque el formulario traiga la fecha', async () => {
      respondeSiempre(201, COMPRA_PAGADA)

      await registrarCompraAction(
        {},
        form({
          proveedorId: 'prv-1',
          lineas: LINEAS,
          medioDePago: 'efectivo',
          venceEl: '2026-10-18',
        }),
      )

      expect(ultimoPedido().body).not.toHaveProperty('venceEl')
    })

    it('a crédito sin fecha tampoco manda la clave vacía', async () => {
      respondeSiempre(201, COMPRA_A_CREDITO)

      await registrarCompraAction(
        {},
        form({ proveedorId: 'prv-1', lineas: LINEAS, medioDePago: 'credito', venceEl: '  ' }),
      )

      expect(ultimoPedido().body).not.toHaveProperty('venceEl')
    })
  })

  it('una compra pagada se confirma sin hablar de vencimiento', async () => {
    respondeSiempre(201, COMPRA_PAGADA)

    const estado = await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(estado.ok).toBe('Compra registrada por $12.000.')
  })

  /*
   * Una compra a crédito que no diga cuándo vence es una deuda que nadie va a
   * mirar hasta que el proveedor la reclame.
   */
  it('una compra a crédito dice cuándo vence, ahí mismo', async () => {
    respondeSiempre(201, COMPRA_A_CREDITO)

    const estado = await registrarCompraAction(
      {},
      form({ proveedorId: 'prv-1', lineas: LINEAS, medioDePago: 'credito', venceEl: '2026-10-18' }),
    )

    expect(estado.ok).toContain('Vence el 2026-10-18')
  })

  it('el mensaje de api/ gana sobre el genérico', async () => {
    respondeSiempre(409, { mensaje: 'Ese proveedor está desactivado.' })

    const estado = await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(estado.error).toBe('Ese proveedor está desactivado.')
  })

  it('un cuerpo con `error` en vez de `mensaje` también se muestra', async () => {
    respondeSiempre(422, { error: 'Falta el costo de una línea.' })

    const estado = await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(estado.error).toBe('Falta el costo de una línea.')
  })

  it('sin cuerpo útil cae al genérico de la compra', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('<html>502</html>', { status: 502 }))

    const estado = await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(estado.error).toBe('No pudimos registrar la compra.')
  })

  it('cuando falla no refresca la pantalla', async () => {
    respondeSiempre(500, {})

    await registrarCompraAction({}, form({ proveedorId: 'prv-1', lineas: LINEAS }))

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('marcarPagadaAction()', () => {
  it('va por POST al pago de esa compra', async () => {
    respondeSiempre(200, { total: '12.000' })

    await marcarPagadaAction({}, form({ compraId: 'com-1' }))

    expect(ultimoPedido().url).toBe('/compras/com-1/pago')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  /*
   * Cuerpo vacío: cuánto se pagó y cuándo lo sabe `api/`. Mandar un monto desde
   * la pantalla dejaría que el navegador decida cuánto se saldó.
   */
  it('no manda monto: cuánto se saldó lo sabe api/', async () => {
    respondeSiempre(200, { total: '12.000' })

    await marcarPagadaAction({}, form({ compraId: 'com-1' }))

    expect(ultimoPedido().body).toEqual({})
  })

  it('el mensaje confirma el monto que devolvió api/', async () => {
    respondeSiempre(200, { total: '12.000' })

    const estado = await marcarPagadaAction({}, form({ compraId: 'com-1' }))

    expect(estado.ok).toBe('Compra de $12.000 marcada como pagada.')
  })

  it('su genérico habla de marcarla pagada', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await marcarPagadaAction({}, form({ compraId: 'com-1' }))

    expect(estado.error).toBe('No pudimos marcarla pagada.')
  })
})
