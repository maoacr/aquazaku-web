import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'

let stdout: ReturnType<typeof vi.spyOn>
let stderr: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  stdout = vi.spyOn(console, 'log').mockImplementation(() => {})
  stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

function parseLast(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const line = spy.mock.calls.at(-1)![0] as string
  return JSON.parse(line) as Record<string, unknown>
}

describe('logger', () => {
  it('emite JSON parseable en una sola línea', () => {
    logger.info({ path: '/ventas' }, 'listo')

    const line = stdout.mock.calls.at(-1)![0] as string
    expect(line).not.toContain('\n')
    expect(() => JSON.parse(line)).not.toThrow()
  })

  it('incluye los campos estructurados que se le pasan', () => {
    logger.error({ status: 500, path: '/usuarios', requestId: 'req-42' }, 'explotó')

    expect(parseLast(stderr)).toMatchObject({
      status: 500,
      path: '/usuarios',
      requestId: 'req-42',
      msg: 'explotó',
    })
  })

  // Mismos números que Pino en api/. Si divergen, una query de logs que filtra
  // por `level >= 50` deja de ver la mitad de los errores del sistema.
  it.each([
    ['debug', 20],
    ['info', 30],
    ['warn', 40],
    ['error', 50],
  ] as const)('mapea %s al nivel numérico %i de Pino', (nivel, esperado) => {
    logger[nivel]({}, 'x')

    const spy = nivel === 'warn' || nivel === 'error' ? stderr : stdout
    expect(parseLast(spy).level).toBe(esperado)
  })

  it('manda debug e info a stdout', () => {
    logger.debug({}, 'a')
    logger.info({}, 'b')

    expect(stdout).toHaveBeenCalledTimes(2)
    expect(stderr).not.toHaveBeenCalled()
  })

  it('manda warn y error a stderr, para poder separarlos del ruido', () => {
    logger.warn({}, 'a')
    logger.error({}, 'b')

    expect(stderr).toHaveBeenCalledTimes(2)
    expect(stdout).not.toHaveBeenCalled()
  })

  it('marca el origen como web para distinguirlo de api/', () => {
    logger.info({}, 'x')

    expect(parseLast(stdout).name).toBe('web')
  })

  it('incluye un timestamp', () => {
    logger.info({}, 'x')

    expect(typeof parseLast(stdout).time).toBe('number')
  })

  // El mensaje es lo último que se escribe, así que un campo `msg` en los
  // fields no puede sobrescribirlo y dejar el log sin explicación.
  it('el mensaje gana sobre un campo msg pasado por error', () => {
    logger.info({ msg: 'impostor' }, 'el verdadero')

    expect(parseLast(stdout).msg).toBe('el verdadero')
  })
})
