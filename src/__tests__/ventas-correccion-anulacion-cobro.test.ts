import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  anularVentaAction,
  corregirVentaAction,
  registrarCobroAction,
} from '@/app/(app)/modulos/ventas/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Lo que se hace con una venta DESPUÉS de cobrarla.
 *
 * ── Corregir no es editar (RN-VEN-02 / RN-VEN-16) ───────────────────────────
 *
 * `api/` vuelve a registrar la venta de cero, con las mismas validaciones de
 * stock, piso, crédito y vigencia. Por eso el cuerpo es el mismo que el de
 * registrar y no un parche: fusionar lo nuevo con lo viejo del lado del
 * servidor sería la edición que la regla prohíbe, escrita en otro lugar.
 *
 * ── Lo que NO puede viajar, y es lo que vigilan estos tests ─────────────────
 *
 * `ocurrioEn` no va. La venta nueva hereda el instante exacto de la que
 * reemplaza, para que arreglar un tipeo no mueva plata de un día —ni de un
 * mes— a otro. Un cierre de mes ya firmado no se mueve porque alguien corrigió
 * una cantidad.
 *
 * Los botellones sin vacío y la base tampoco: son movimientos FÍSICOS que ya
 * ocurrieron y siguen colgando de la venta original. El envase salió una vez.
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

function rutasRefrescadas(): string[] {
  return vi.mocked(revalidatePath).mock.calls.map((c) => String(c[0]))
}

const CARRITO = JSON.stringify([{ productoId: 'prod-1', cantidad: 2 }])

const CORRECCION = {
  venta: { total: '24000' },
  reemplazada: { total: '12000' },
}

const BASE = { ventaId: 'ven-1', motivo: 'cobré dos y eran tres', items: CARRITO }

afterEach(() => {
  vi.clearAllMocks()
})

describe('corregirVentaAction() — lo que viaja', () => {
  it('va por POST a la corrección de esa venta', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form(BASE))

    expect(ultimoPedido().url).toBe('/ventas/ven-1/correccion')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('el motivo viaja recortado: es lo único que explica la corrección', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, motivo: '  cobré de menos  ' }))

    expect(ultimoPedido().body.motivo).toBe('cobré de menos')
  })

  /*
   * La regla de la fecha en la corrección — RN-VEN-16 fecha corregible.
   *
   * El modal pre-carga con la fecha ORIGINAL — `ocurrioEnOriginal` —
   * `ocurrioEn` viaja SIEMPRE que el campo trae un valor:
   *
   * - vacío ⇒ se omite, `api/` hereda el instante de la original;
   * - con día distinto ⇒ `api/` valida dentro del piso de 90 días;
   * - igual a la original ⇒ se manda igual (D10): la auditoría registra la
   *   intención del admin, no la herencia silenciosa.
   */
  it('manda `ocurrioEn` cuando el modal trae un día distinto al de hoy', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, ocurrioEn: '2026-08-20' }))

    expect(ultimoPedido().body.ocurrioEn).toBe('2026-08-20')
  })

  it('manda `ocurrioEn` igual al original sin filtrarlo — D10', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, ocurrioEn: '2026-09-15' }))

    expect(ultimoPedido().body.ocurrioEn).toBe('2026-09-15')
  })

  it('omite `ocurrioEn` cuando el campo viene vacío', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, ocurrioEn: '   ' }))

    expect(ultimoPedido().body).not.toHaveProperty('ocurrioEn')
  })

  /*
   * El envase salió una vez. Volver a mandarlo lo contaría dos veces, y el
   * cliente quedaría figurando con el doble de botellones sin vacío.
   */
  it('NUNCA manda botellones ni base: el envase físico ya salió', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction(
      {},
      form({ ...BASE, botellonesSinVacio: '2', baseId: 'base-1', idSticker: '0042' }),
    )

    const { body } = ultimoPedido()
    expect(body).not.toHaveProperty('botellonesSinVacio')
    expect(body).not.toHaveProperty('baseId')
    expect(body).not.toHaveProperty('idSticker')
  })

  it('el carrito viaja como lista, no como el texto del campo oculto', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form(BASE))

    expect(ultimoPedido().body.items).toEqual([{ productoId: 'prod-1', cantidad: 2 }])
  })

  it('sin medio de pago elegido asume efectivo', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form(BASE))

    expect(ultimoPedido().body.medioDePago).toBe('efectivo')
  })

  it('sin cliente no manda la clave: una venta de mostrador no tiene dueño', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form(BASE))

    expect(ultimoPedido().body).not.toHaveProperty('clienteId')
  })

  it('con cliente lo manda', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, clienteId: 'cli-1' }))

    expect(ultimoPedido().body.clienteId).toBe('cli-1')
  })

  it('sin código de descuento no manda la clave vacía', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, codigoDescuento: '   ' }))

    expect(ultimoPedido().body).not.toHaveProperty('codigoDescuento')
  })

  it('solo el «si» pide factura electrónica', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form({ ...BASE, requiereFactura: 'si' }))
    expect(ultimoPedido().body.requiereFacturaElectronica).toBe(true)

    await corregirVentaAction({}, form(BASE))
    expect(ultimoPedido().body.requiereFacturaElectronica).toBe(false)
  })
})

/**
 * El carrito lo parsea la MISMA función que usa registrar.
 *
 * Duplicar ese parseo dejaría que el aviso sobre el precio a mano existiera en
 * un camino y no en el otro — y corregir es justamente donde más se toca un
 * precio escrito a mano.
 */
describe('corregirVentaAction() — el carrito se valida igual que al registrar', () => {
  it('un carrito vacío se ataja antes del viaje', async () => {
    const estado = await corregirVentaAction({}, form({ ...BASE, items: '[]' }))

    expect(estado.error).toBe('Agregue al menos un producto antes de cobrar.')
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('la casilla de precio a mano tildada sin número también', async () => {
    const estado = await corregirVentaAction(
      {},
      form({
        ...BASE,
        items: JSON.stringify([{ productoId: 'prod-1', cantidad: 2, precioManual: '  ' }]),
      }),
    )

    expect(estado.error).toMatch(/Escriba el precio que cobró/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('un precio a mano escrito viaja recortado', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction(
      {},
      form({
        ...BASE,
        items: JSON.stringify([{ productoId: 'prod-1', cantidad: 2, precioManual: ' 3500 ' }]),
      }),
    )

    expect(ultimoPedido().body.items).toEqual([
      { productoId: 'prod-1', cantidad: 2, precioManual: '3500' },
    ])
  })
})

describe('corregirVentaAction() — lo que se cuenta al volver', () => {
  it('dice de cuánto a cuánto, con separadores de miles', async () => {
    respondeSiempre(201, { venta: { total: '24000' }, reemplazada: { total: '12000' } })

    const estado = await corregirVentaAction({}, form(BASE))

    expect(estado.ok).toBe('Venta corregida: de $12.000 a $24.000.')
  })

  /*
   * Corregir un cliente mal elegido no cambia el total. Decir «de $12.000 a
   * $12.000» haría dudar de si la corrección se aplicó.
   */
  it('si el total no cambió lo dice, en vez de repetir el mismo número dos veces', async () => {
    respondeSiempre(201, { venta: { total: '12000' }, reemplazada: { total: '12000' } })

    const estado = await corregirVentaAction({}, form(BASE))

    expect(estado.ok).toBe('Venta corregida. El total no cambió.')
  })

  it('refresca ventas, stock y clientes: la corrección mueve las tres', async () => {
    respondeSiempre(201, CORRECCION)

    await corregirVentaAction({}, form(BASE))

    expect(rutasRefrescadas()).toContain('/modulos/stock')
    expect(revalidatePath).toHaveBeenCalledWith('/modulos/clientes', 'layout')
  })

  it('un 422 pasa el mensaje de api/ tal cual', async () => {
    respondeSiempre(422, { mensaje: 'El lote ya no tiene stock para esa cantidad.' })

    const estado = await corregirVentaAction({}, form(BASE))

    expect(estado.error).toBe('El lote ya no tiene stock para esa cantidad.')
  })

  it('su genérico habla de corregir', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await corregirVentaAction({}, form(BASE))

    expect(estado.error).toBe('No pudimos corregir la venta.')
  })

  it('cuando falla no refresca nada', async () => {
    respondeSiempre(500, {})

    await corregirVentaAction({}, form(BASE))

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('anularVentaAction()', () => {
  it('va por POST a la anulación, con el motivo recortado', async () => {
    respondeSiempre(200, {})

    await anularVentaAction({}, form({ ventaId: 'ven-1', motivo: '  se arrepintió  ' }))

    expect(ultimoPedido().url).toBe('/ventas/ven-1/anulacion')
    expect(ultimoPedido().body).toEqual({ motivo: 'se arrepintió' })
  })

  /*
   * El mensaje aclara que el producto volvió al lote. Sin eso, quien anula no
   * sabe si tiene que ir a stock a devolverlo a mano — y devolverlo a mano lo
   * contaría dos veces.
   */
  it('avisa que el producto volvió a su lote: si no, alguien lo devuelve a mano', async () => {
    respondeSiempre(200, {})

    const estado = await anularVentaAction({}, form({ ventaId: 'ven-1', motivo: 'x' }))

    expect(estado.ok).toBe('Venta anulada. El producto volvió a su lote.')
  })

  it('refresca ventas y stock: el lote recuperó unidades', async () => {
    respondeSiempre(200, {})

    await anularVentaAction({}, form({ ventaId: 'ven-1', motivo: 'x' }))

    expect(rutasRefrescadas()).toContain('/modulos/stock')
  })

  it('su genérico habla de anular', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await anularVentaAction({}, form({ ventaId: 'ven-1', motivo: 'x' }))

    expect(estado.error).toBe('No pudimos anular la venta.')
  })
})

describe('registrarCobroAction()', () => {
  const SALDADA = { deudaRestante: '0', quedaSaldada: true }
  const PARCIAL = { deudaRestante: '8000', quedaSaldada: false }

  it('va por POST a cobros, con el monto como texto recortado', async () => {
    respondeSiempre(201, SALDADA)

    await registrarCobroAction({}, form({ clienteId: 'cli-1', monto: '  12000  ' }))

    expect(ultimoPedido().url).toBe('/cobros')
    expect(ultimoPedido().body).toMatchObject({ clienteId: 'cli-1', monto: '12000' })
  })

  it('sin medio de pago elegido asume efectivo', async () => {
    respondeSiempre(201, SALDADA)

    await registrarCobroAction({}, form({ clienteId: 'cli-1', monto: '12000' }))

    expect(ultimoPedido().body.medioDePago).toBe('efectivo')
  })

  it('sin observaciones no manda la clave en blanco', async () => {
    respondeSiempre(201, SALDADA)

    await registrarCobroAction(
      {},
      form({ clienteId: 'cli-1', monto: '12000', observaciones: '   ' }),
    )

    expect(ultimoPedido().body).not.toHaveProperty('observaciones')
  })

  /*
   * «Queda al día» y «quedan $8.000» son dos noticias distintas para quien está
   * cobrando en la puerta: una cierra la conversación y la otra no.
   */
  it('cuando queda saldada lo dice, sin hablar de pesos', async () => {
    respondeSiempre(201, SALDADA)

    const estado = await registrarCobroAction({}, form({ clienteId: 'cli-1', monto: '12000' }))

    expect(estado.ok).toBe('Cobro registrado. El cliente queda al día.')
  })

  it('cuando queda deuda dice cuánta, con separadores de miles', async () => {
    respondeSiempre(201, PARCIAL)

    const estado = await registrarCobroAction({}, form({ clienteId: 'cli-1', monto: '4000' }))

    expect(estado.ok).toBe('Cobro registrado. Quedan $8.000.')
  })

  it('refresca la ficha de ESE cliente, no la lista entera', async () => {
    respondeSiempre(201, SALDADA)

    await registrarCobroAction({}, form({ clienteId: 'cli-1', monto: '12000' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/clientes/cli-1')
  })

  it('su genérico habla del cobro', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await registrarCobroAction({}, form({ clienteId: 'cli-1', monto: '12000' }))

    expect(estado.error).toBe('No pudimos registrar el cobro.')
  })
})
