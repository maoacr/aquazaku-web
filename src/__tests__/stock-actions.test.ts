import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ajustarLoteAction,
  descartarAction,
  registrarEntradaAction,
} from '@/app/(app)/modulos/stock/actions'

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

function ultimoPedido(): { url: string; body: Record<string, unknown> } {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return { url: llamada[0], body: init.body ? JSON.parse(String(init.body)) : {} }
}

const MOTIVO_VALIDO = 'conteo físico del lunes'

afterEach(() => {
  vi.clearAllMocks()
})

describe('el motivo mínimo se avisa antes de mandar', () => {
  it.each([
    ['vacío', ''],
    ['de relleno', 'x'],
    ['de nueve caracteres', 'no cuadró'],
  ])('un motivo %s no gasta un viaje a api/', async (_caso, motivo) => {
    const estado = await ajustarLoteAction({}, form({ loteId: 'l1', cantidad: '-5', motivo }))

    expect(estado.error).toMatch(/tres meses/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('con diez caracteres ya viaja: el mínimo es el mínimo', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, { saldo: 95 }))

    await ajustarLoteAction({}, form({ loteId: 'l1', cantidad: '-5', motivo: 'sobrantesX' }))

    expect(apiServerFetchRaw).toHaveBeenCalled()
  })
})

describe('ajustarLoteAction()', () => {
  it('un ajuste de cero no llega a api/', async () => {
    const estado = await ajustarLoteAction(
      {},
      form({ loteId: 'l1', cantidad: '0', motivo: MOTIVO_VALIDO }),
    )

    expect(estado.error).toMatch(/no corrige nada/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('devuelve el saldo resultante para que el operario lo vea', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, { saldo: 92 }))

    const estado = await ajustarLoteAction(
      {},
      form({ loteId: 'l1', cantidad: '-8', motivo: MOTIVO_VALIDO }),
    )

    expect(estado.ok).toContain('92')
  })

  it('muestra el mensaje de api/ cuando no alcanza el stock, no uno propio', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(409, {
        code: 'STOCK_INSUFICIENTE',
        mensaje: 'el lote tiene 10 unidades: no se pueden descontar 50',
      }),
    )

    const estado = await ajustarLoteAction(
      {},
      form({ loteId: 'l1', cantidad: '-50', motivo: MOTIVO_VALIDO }),
    )

    expect(estado.error).toBe('el lote tiene 10 unidades: no se pueden descontar 50')
  })
})

describe('descartarAction()', () => {
  it('sin causa no viaja: el descarte no diría quién responde', async () => {
    const estado = await descartarAction({}, form({ loteId: 'l1', cantidad: '3', causa: '' }))

    expect(estado.error).toMatch(/causa/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('con causa "otro" exige explicación antes de mandar', async () => {
    const estado = await descartarAction(
      {},
      form({ loteId: 'l1', cantidad: '3', causa: 'otro', observaciones: 'se mojó' }),
    )

    expect(estado.error).toMatch(/explicar qué pasó/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it.each(['falla_produccion', 'mal_manejo_cliente', 'vencido'])(
    'la causa %s no exige explicación: ya dice qué pasó',
    async (causa) => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, { saldo: 97 }))

      const estado = await descartarAction({}, form({ loteId: 'l1', cantidad: '3', causa }))

      expect(estado.ok).toBeDefined()
    },
  )

  it('no manda observaciones vacías: api/ las trata como ausentes', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, { saldo: 97 }))

    await descartarAction({}, form({ loteId: 'l1', cantidad: '3', causa: 'vencido' }))

    expect(ultimoPedido().body).not.toHaveProperty('observaciones', '')
  })
})

describe('registrarEntradaAction()', () => {
  it('devuelve el código de lote y el vencimiento generados por api/', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(201, { codigo: '2026-08-22-L1', fechaVencimiento: '2026-09-21' }),
    )

    const estado = await registrarEntradaAction(
      {},
      form({ productoId: 'p1', cantidad: '120', fechaEmpaque: '2026-08-22', motivo: MOTIVO_VALIDO }),
    )

    expect(estado.ok).toContain('2026-08-22-L1')
    expect(estado.ok).toContain('2026-09-21')
  })

  it('no manda código de lote: lo genera api/', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { codigo: 'X', fechaVencimiento: 'Y' }))

    await registrarEntradaAction(
      {},
      form({ productoId: 'p1', cantidad: '10', fechaEmpaque: '2026-08-22', motivo: MOTIVO_VALIDO }),
    )

    expect(ultimoPedido().body).not.toHaveProperty('codigo')
  })

  it('una cantidad de cero no llega a api/', async () => {
    const estado = await registrarEntradaAction(
      {},
      form({ productoId: 'p1', cantidad: '0', fechaEmpaque: '2026-08-22', motivo: MOTIVO_VALIDO }),
    )

    expect(estado.error).toMatch(/mayor que cero/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })
})
