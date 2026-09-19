import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ajustarAguaAction,
  registrarCierreAction,
  registrarReposicionAction,
} from '@/app/(app)/modulos/produccion/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Mutaciones de producción — M4.
 *
 * ── La regla que más se rompe sola ──────────────────────────────────────────
 *
 * Hay dos números que el sistema NO inventa: el caudal y los litros por lavado.
 * Se miden con un balde y un cronómetro, y si no se midieron, no se mandan.
 * Mandar un cero sería una MEDICIÓN FALSA, no un dato faltante — y de esos
 * números salen los litros de agua que se le descuentan al tanque.
 *
 * ── La reposición no lleva cantidad, y tampoco es un olvido ─────────────────
 *
 * No hay medidor ni regleta (RN-PRD-11). Se anota que llegó agua, y el saldo
 * sube después con un ajuste explícito y con motivo. Así queda separado lo
 * medido de lo estimado.
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

const DIA = { fecha: '2026-09-18', minutosProcesando: '240', pacas600: '30', pacas300: '12' }
const SIN_LOTES = { lotes: [] }

afterEach(() => {
  vi.clearAllMocks()
})

describe('registrarCierreAction() — lo que viaja', () => {
  it('va por POST a los cierres de producción', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form(DIA))

    expect(ultimoPedido().url).toBe('/produccion/cierres')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('los conteos viajan como números, no como texto', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction(
      {},
      form({ ...DIA, botellonesLlenados: '80', botellonesLavados: '75' }),
    )

    expect(ultimoPedido().body).toMatchObject({
      minutosProcesando: 240,
      pacas600: 30,
      pacas300: 12,
      botellonesLlenados: 80,
      botellonesLavados: 75,
    })
  })

  /*
   * Un conteo que no se llenó SÍ es cero: no se envasaron pacas de 300 ese día
   * es un hecho, no una medición faltante. Acá el cero es verdad.
   */
  it('un conteo sin llenar viaja como cero: «no se envasó» es un hecho', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ fecha: '2026-09-18' }))

    expect(ultimoPedido().body).toMatchObject({
      minutosProcesando: 0,
      pacas600: 0,
      pacas300: 0,
      botellonesLlenados: 0,
      botellonesLavados: 0,
    })
  })
})

/**
 * Los dos números que se miden con un balde.
 *
 * De acá salen los litros que se le descuentan al tanque. Un cero fingido
 * significaría «el proceso no consumió agua», que es falso y además invisible:
 * el tanque quedaría marcando de más para siempre.
 */
describe('registrarCierreAction() — lo medido y lo no medido', () => {
  it('sin caudal medido NO manda la clave: un cero sería una medición falsa', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ ...DIA, caudalGpm: '' }))

    expect(ultimoPedido().body).not.toHaveProperty('caudalGpm')
  })

  it('sin litros por lavado tampoco', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ ...DIA, litrosPorLavado: '   ' }))

    expect(ultimoPedido().body).not.toHaveProperty('litrosPorLavado')
  })

  it('con las mediciones hechas, viajan como números', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ ...DIA, caudalGpm: '12.5', litrosPorLavado: '3' }))

    const { body } = ultimoPedido()
    expect(body.caudalGpm).toBe(12.5)
    expect(body.litrosPorLavado).toBe(3)
  })

  /*
   * Un caudal de cero medido de verdad es distinto de un caudal sin medir: la
   * bomba estuvo parada. Por eso el cero explícito SÍ viaja.
   */
  it('un cero escrito a propósito SÍ viaja: la bomba estuvo parada', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ ...DIA, caudalGpm: '0' }))

    expect(ultimoPedido().body).toHaveProperty('caudalGpm', 0)
  })

  it('sin nivel observado no manda la clave', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ ...DIA, nivelObservado: '' }))

    expect(ultimoPedido().body).not.toHaveProperty('nivelObservado')
  })

  it('con nivel observado lo manda recortado', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form({ ...DIA, nivelObservado: '  medio  ' }))

    expect(ultimoPedido().body.nivelObservado).toBe('medio')
  })
})

describe('registrarCierreAction() — lo que se cuenta al volver', () => {
  it('sin lotes lo dice: no se envasó nada ese día', async () => {
    respondeSiempre(201, { lotes: [] })

    const estado = await registrarCierreAction({}, form(DIA))

    expect(estado.ok).toBe('Cierre registrado. No se envasó nada ese día.')
  })

  it('con un lote habla en singular', async () => {
    respondeSiempre(201, { lotes: [{ codigo: '2026-09-18-L1' }] })

    const estado = await registrarCierreAction({}, form(DIA))

    expect(estado.ok).toBe('Cierre registrado. Se generó el lote 2026-09-18-L1.')
  })

  it('con varios los nombra a todos, separados por coma', async () => {
    respondeSiempre(201, {
      lotes: [{ codigo: '2026-09-18-L1' }, { codigo: '2026-09-18-L2' }],
    })

    const estado = await registrarCierreAction({}, form(DIA))

    expect(estado.ok).toBe(
      'Cierre registrado. Se generaron los lotes 2026-09-18-L1, 2026-09-18-L2.',
    )
  })

  /*
   * El cierre genera lotes y consume insumos: las tres pantallas cambian. Sin
   * revalidar stock e insumos, quien cierra el día va a stock y ve el saldo
   * anterior — y concluye que el cierre no se guardó.
   */
  it('refresca producción, stock e insumos: el cierre mueve las tres', async () => {
    respondeSiempre(201, SIN_LOTES)

    await registrarCierreAction({}, form(DIA))

    expect(rutasRefrescadas()).toContain('/modulos/produccion')
    expect(rutasRefrescadas()).toContain('/modulos/stock')
    expect(rutasRefrescadas()).toContain('/modulos/insumos')
  })

  it('un día ya cerrado se explica en castellano, no con el error de Postgres', async () => {
    respondeSiempre(409, { code: 'DB_ERROR', mensaje: 'duplicate key value violates unique' })

    const estado = await registrarCierreAction({}, form(DIA))

    expect(estado.error).toBe(
      'Ya hay un cierre registrado para esa fecha. Un día tiene un solo cierre.',
    )
  })

  it('INSUMOS_INSUFICIENTES pasa el mensaje de api/ tal cual', async () => {
    respondeSiempre(422, {
      code: 'INSUMOS_INSUFICIENTES',
      mensaje: 'Faltan 120 tapas para ese envasado.',
    })

    const estado = await registrarCierreAction({}, form(DIA))

    expect(estado.error).toBe('Faltan 120 tapas para ese envasado.')
  })

  it('cuando falla no refresca nada', async () => {
    respondeSiempre(500, {})

    await registrarCierreAction({}, form(DIA))

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

/**
 * «Llegó agua y se llenó el tanque» — sin cantidad.
 *
 * No hay medidor ni regleta (RN-PRD-11). El saldo sube después con un ajuste
 * explícito y con motivo, así queda separado lo medido de lo estimado.
 */
describe('registrarReposicionAction()', () => {
  it('va por POST a la reposición del tanque', async () => {
    respondeSiempre(201, {})

    await registrarReposicionAction({}, form({ tanque: 'crudo' }))

    expect(ultimoPedido().url).toBe('/tanques/reposicion')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('manda SOLO el tanque: no hay cantidad que mandar', async () => {
    respondeSiempre(201, {})

    await registrarReposicionAction({}, form({ tanque: 'crudo', litros: '1000' }))

    expect(ultimoPedido().body).toEqual({ tanque: 'crudo' })
  })

  /*
   * El mensaje pide el paso siguiente. Sin eso, quien anota la llegada del agua
   * cree que el saldo ya se actualizó, y el tanque queda marcando de menos.
   */
  it('el mensaje pide el ajuste siguiente: la reposición sola no mueve el saldo', async () => {
    respondeSiempre(201, {})

    const estado = await registrarReposicionAction({}, form({ tanque: 'crudo' }))

    expect(estado.ok).toMatch(/Ajuste el saldo/)
  })

  it('refresca la pantalla de producción', async () => {
    respondeSiempre(201, {})

    await registrarReposicionAction({}, form({ tanque: 'crudo' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/produccion')
  })

  it('su genérico habla de la reposición', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await registrarReposicionAction({}, form({ tanque: 'crudo' }))

    expect(estado.error).toBe('No pudimos registrar la reposición.')
  })
})

describe('ajustarAguaAction()', () => {
  it('va por POST al ajuste, con litros y motivo', async () => {
    respondeSiempre(200, { litros: 4200 })

    await ajustarAguaAction(
      {},
      form({ tanque: 'crudo', litros: '500', motivo: '  nivel a la mitad  ' }),
    )

    expect(ultimoPedido().url).toBe('/tanques/ajuste')
    expect(ultimoPedido().body).toEqual({
      tanque: 'crudo',
      litros: 500,
      motivo: 'nivel a la mitad',
    })
  })

  it('el éxito dice en cuánto quedó el tanque, no cuánto se ajustó', async () => {
    respondeSiempre(200, { litros: 4200 })

    const estado = await ajustarAguaAction(
      {},
      form({ tanque: 'crudo', litros: '500', motivo: 'nivel' }),
    )

    expect(estado.ok).toBe('Ajuste registrado. El tanque queda en 4200 litros.')
  })

  it('un 403 dice que no tiene permiso', async () => {
    respondeSiempre(403, {})

    const estado = await ajustarAguaAction(
      {},
      form({ tanque: 'crudo', litros: '500', motivo: 'nivel' }),
    )

    expect(estado.error).toBe('No tiene permiso para hacer esto.')
  })
})
