import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')
const { anularVentaAction, corregirVentaAction, registrarVentaAction } = await import(
  '@/app/(app)/modulos/ventas/actions'
)

/**
 * Tocar una venta tiene que refrescar Seguimientos.
 *
 * ── El bug que esto evita ───────────────────────────────────────────────────
 *
 * Seguimientos lee la fecha de la ÚLTIMA venta de cada dirección, así que
 * cualquier cosa que toque una venta lo cambia. Pero las acciones de Ventas
 * revalidaban ventas, stock y clientes — nunca seguimientos.
 *
 * Lo reportó la operación con un caso concreto: una venta de 40 días sin
 * dirección arriba de la lista, el cliente compra hoy, se le asigna la
 * dirección a la vieja con el lápiz… y la fila de 40 días seguía primera. La
 * API ya devolvía UNA sola fila con 0 días —está probado en
 * `api/src/modules/clientes/__tests__/a-llamar.test.ts`—; lo que no se volvía a
 * pedir era la página.
 *
 * ── Por qué un test tan tonto ───────────────────────────────────────────────
 *
 * Porque una línea de `revalidatePath` no tiene efecto visible en ningún otro
 * test: se puede borrar y toda la suite sigue verde. El síntoma aparece recién
 * en pantalla, días después, y se lee como «la lista está mal» y no como «falta
 * una línea de caché».
 */

const OK = { ok: true, json: async () => ({ venta: { id: 'v1', total: '100' }, reemplazada: { id: 'v0', total: '100' }, lineas: [] }) } as unknown as Response

const formulario = (extra: Record<string, string> = {}) => {
  const fd = new FormData()
  fd.set('medioDePago', 'efectivo')
  fd.set('items', JSON.stringify([{ productoId: 'p1', cantidad: 1 }]))
  fd.set('motivo', 'se registró a qué dirección se entregó esta venta')
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)

  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiServerFetchRaw).mockResolvedValue(OK)
})

describe('Seguimientos se revalida', () => {
  it('al corregir una venta — el caso del lápiz', async () => {
    await corregirVentaAction({}, formulario({ ventaId: 'v0' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/seguimientos')
  })

  it('al registrar una venta nueva', async () => {
    await registrarVentaAction({}, formulario())

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/seguimientos')
  })

  it('al anular una venta: el reloj vuelve a contar desde la anterior', async () => {
    await anularVentaAction({}, formulario({ ventaId: 'v0' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/seguimientos')
  })
})
