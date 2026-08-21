import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cambiarEstadoAction,
  crearProductoAction,
  editarPreciosAction,
} from '@/app/(app)/modulos/productos/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')

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

function ultimoPedido(): { url: string; init: RequestInit; body: unknown } {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return { url: llamada[0], init, body: init.body ? JSON.parse(String(init.body)) : null }
}

const NUEVO = {
  nombre: 'Paca de 20 bolsas de 600 ml',
  presentacion: 'paca',
  contenidoMl: '600',
  unidades: '20',
  precioResidencial: '12000',
  precioComercial: '11000',
  precioMinimo: '9000',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('crearProductoAction()', () => {
  it('no gasta un viaje a api/ si falta el nombre', async () => {
    const estado = await crearProductoAction({}, form({ ...NUEVO, nombre: '' }))

    expect(estado.error).toMatch(/nombre/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('rechaza cero unidades sin llamar a api/', async () => {
    const estado = await crearProductoAction({}, form({ ...NUEVO, unidades: '0' }))

    expect(estado.error).toMatch(/al menos una unidad/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('no manda código: lo genera api/ — RN-CAT-11', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { codigo: 'P20U_600ML' }))

    await crearProductoAction({}, form(NUEVO))

    const { url, body } = ultimoPedido()
    expect(url).toBe('/productos')
    expect(body).not.toHaveProperty('codigo')
  })

  it('devuelve el código generado para que el admin lo vea', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { codigo: 'P20U_600ML' }))

    const estado = await crearProductoAction({}, form(NUEVO))

    expect(estado.ok).toContain('P20U_600ML')
  })

  it('los montos viajan como string, sin pasar por un float', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { codigo: 'X' }))

    await crearProductoAction({}, form({ ...NUEVO, precioResidencial: '12000.50' }))

    const { body } = ultimoPedido() as { body: Record<string, unknown> }
    expect(body.precioResidencial).toBe('12000.50')
    expect(typeof body.precioResidencial).toBe('string')
  })

  it('muestra el mensaje de api/ cuando el piso es inválido, no uno propio', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(422, {
        code: 'PRECIO_MINIMO_INVALIDO',
        mensaje: 'el precio mínimo no puede superar ningún precio de lista',
      }),
    )

    const estado = await crearProductoAction({}, form(NUEVO))

    expect(estado.error).toBe('el precio mínimo no puede superar ningún precio de lista')
  })

  it('un 403 se explica en castellano', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(403, { code: 'FORBIDDEN' }))

    const estado = await crearProductoAction({}, form(NUEVO))

    expect(estado.error).toMatch(/permiso/i)
  })
})

describe('editarPreciosAction()', () => {
  it('manda los tres precios juntos al endpoint que les corresponde', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await editarPreciosAction({}, form({ id: 'p1', ...NUEVO }))

    const { url, init, body } = ultimoPedido()
    expect(url).toBe('/productos/p1/precios')
    expect(init.method).toBe('PATCH')
    expect(body).toEqual({
      precioResidencial: '12000',
      precioComercial: '11000',
      precioMinimo: '9000',
    })
  })

  it('no manda el nombre: esa es otra ruta y otro permiso', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await editarPreciosAction({}, form({ id: 'p1', ...NUEVO }))

    expect(ultimoPedido().body).not.toHaveProperty('nombre')
  })

  it('avisa que el cambio quedó auditado', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    const estado = await editarPreciosAction({}, form({ id: 'p1', ...NUEVO }))

    expect(estado.ok).toMatch(/auditor/i)
  })
})

describe('cambiarEstadoAction()', () => {
  it('desactivar es un POST a su propia ruta, nunca un DELETE — RN-CAT-02', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await cambiarEstadoAction({}, form({ id: 'p1', activar: 'no' }))

    const { url, init } = ultimoPedido()
    expect(url).toBe('/productos/p1/desactivar')
    expect(init.method).toBe('POST')
    expect(init.method).not.toBe('DELETE')
  })

  it('reactivar pega en la ruta simétrica', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await cambiarEstadoAction({}, form({ id: 'p1', activar: 'si' }))

    expect(ultimoPedido().url).toBe('/productos/p1/reactivar')
  })

  it('al desactivar aclara que el producto sigue existiendo', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    const estado = await cambiarEstadoAction({}, form({ id: 'p1', activar: 'no' }))

    expect(estado.ok).toMatch(/sigue existiendo/i)
  })

  it('un 409 de doble desactivación se explica sin jerga', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(409, { code: 'PRODUCTO_YA_INACTIVO' }),
    )

    const estado = await cambiarEstadoAction({}, form({ id: 'p1', activar: 'no' }))

    expect(estado.error).toBe('El producto ya estaba desactivado.')
  })
})
