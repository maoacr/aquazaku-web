import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asignarDireccionAction } from '@/app/(app)/modulos/seguimientos/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetch, apiServerFetchRaw } = await import('@/lib/api-server')

/**
 * Asignarle la dirección a una venta que no la registró — M15.
 *
 * ── Lo que se vigila, y por qué es el cuerpo y no el render ─────────────────
 *
 * Esto NO edita la venta: la **corrige**. Anula la vieja y registra una nueva.
 * O sea que lo que viaja en el `POST` **es la venta nueva entera**: un campo
 * que se olvide acá no queda vacío, queda CAMBIADO. Un `botellonesRecibidos`
 * perdido no es un dato faltante — es el saldo de envases del cliente movido
 * sin que nadie lo pidiera.
 *
 * Por eso las aserciones miran el JSON que sale, que es donde vive el riesgo.
 * Que el stock y los botellones queden iguales del otro lado ya está medido en
 * `api/src/modules/ventas/__tests__/asignar-direccion.test.ts`; acá se prueba
 * que se le mande lo correcto.
 */

const VENTA = {
  id: 'v1',
  clienteId: 'c1',
  medioDePago: 'efectivo',
  total: '30000.00',
  /*
   * 27-ago 02:30 UTC = **26-ago 21:30** en la planta. Los dos días NO coinciden,
   * y eso es a propósito: con una hora del mediodía este fixture pasaría igual
   * recortando el ISO, y el test de abajo diría que vigila la zona horaria sin
   * vigilar nada. Se descubrió ablacionando — la versión anterior usaba 23:30
   * UTC, que en la planta sigue siendo el mismo día.
   */
  createdAt: '2026-08-27T02:30:00.000Z',
  botellonesEntregados: 3,
  botellonesRecibidos: 2,
  lineas: [
    { productoId: 'p1', productoNombre: 'Botellón', cantidad: 3, precioFinal: '10000.00', precioManual: false },
  ],
  devoluciones: [],
}

const formulario = (direccionId = 'd1') => {
  const fd = new FormData()
  fd.set('ventaId', 'v1')
  fd.set('direccionId', direccionId)

  return fd
}

const cuerpoEnviado = () =>
  JSON.parse(vi.mocked(apiServerFetchRaw).mock.calls[0]![1]!.body as string)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiServerFetch).mockResolvedValue(VENTA as never)
  vi.mocked(apiServerFetchRaw).mockResolvedValue({ ok: true } as Response)
})

describe('la venta se reenvía completa, no parcheada', () => {
  it('conserva medio de pago, cliente, ítems y precios', async () => {
    await asignarDireccionAction({}, formulario())

    expect(cuerpoEnviado()).toMatchObject({
      medioDePago: 'efectivo',
      clienteId: 'c1',
      items: [{ productoId: 'p1', cantidad: 3, precioManual: '10000.00' }],
    })
  })

  it('el precio viaja como STRING: `precioManual` usa el formato `dinero`', async () => {
    await asignarDireccionAction({}, formulario())

    /*
     * `dinero` es `^\d+(\.\d{1,2})?$`. Pasar el precio por `Number()` lo
     * volvería `10000` y el esquema lo rechazaría — con un 422 que hablaría de
     * un campo que nadie tocó.
     */
    expect(typeof cuerpoEnviado().items[0].precioManual).toBe('string')
  })

  it('conserva los botellones entregados y recibidos', async () => {
    await asignarDireccionAction({}, formulario())

    /*
     * El test que más caro sale si falta. Olvidarlos mandaría `undefined`, la
     * venta nueva entraría con cero, y el saldo de envases del cliente
     * cambiaría por haber completado una dirección.
     */
    expect(cuerpoEnviado()).toMatchObject({
      botellonesEntregados: 3,
      botellonesRecibidos: 2,
    })
  })

  it('agrega la dirección elegida', async () => {
    await asignarDireccionAction({}, formulario('d-elegida'))

    expect(cuerpoEnviado().direccionId).toBe('d-elegida')
  })
})

describe('la fecha', () => {
  it('manda `ocurrioEn` con el día de la planta, no el de UTC', async () => {
    await asignarDireccionAction({}, formulario())

    /*
     * La venta es del 27-ago 02:30 UTC, o sea el 26 a las 21:30 en Campo de la
     * Cruz. Recortar el ISO daría «2026-08-27»: un día de más para todo lo
     * vendido después de las 19:00. Acá eso no es cosmético — corre la venta un
     * día dentro del tope de 90, y le cambia el día al reporte.
     */
    expect(cuerpoEnviado().ocurrioEn).toBe('2026-08-26')
  })

  it('`ocurrioEn` no es opcional: sin él FEFO mira hoy y el lote ya venció', async () => {
    await asignarDireccionAction({}, formulario())

    expect(cuerpoEnviado().ocurrioEn).toBeTruthy()
  })
})

describe('lo que no se intenta', () => {
  it('una venta con devoluciones ni se manda: se explica antes', async () => {
    vi.mocked(apiServerFetch).mockResolvedValue({ ...VENTA, devoluciones: [{ id: 'dev1' }] } as never)

    const estado = await asignarDireccionAction({}, formulario())

    expect(apiServerFetchRaw).not.toHaveBeenCalled()
    expect(estado.error).toMatch(/devoluciones/)
  })

  it('sin dirección elegida no se manda nada', async () => {
    const fd = new FormData()
    fd.set('ventaId', 'v1')

    const estado = await asignarDireccionAction({}, fd)

    expect(apiServerFetchRaw).not.toHaveBeenCalled()
    expect(estado.error).toBeTruthy()
  })
})

describe('cuando api dice que no', () => {
  const rechaza = (code: string) =>
    vi.mocked(apiServerFetchRaw).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ code, mensaje: 'mensaje crudo' }),
    } as unknown as Response)

  it('el tope de 90 días se explica como calendario, no como error del usuario', async () => {
    rechaza('VENTA_DEMASIADO_VIEJA')

    const estado = await asignarDireccionAction({}, formulario())

    expect(estado.error).toMatch(/90 días/)
  })

  it('el stock insuficiente manda a soporte en vez de invitar a reintentar', async () => {
    rechaza('STOCK_INSUFICIENTE')

    const estado = await asignarDireccionAction({}, formulario())

    expect(estado.error).toMatch(/soporte/)
  })
})

describe('cuando sale bien', () => {
  it('avisa y revalida la lista', async () => {
    const { revalidatePath } = await import('next/cache')

    const estado = await asignarDireccionAction({}, formulario())

    expect(estado.ok).toBeTruthy()
    expect(revalidatePath).toHaveBeenCalledWith('/modulos/seguimientos')
  })
})
