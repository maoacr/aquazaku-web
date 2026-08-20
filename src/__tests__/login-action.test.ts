import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loginAction } from '@/app/(auth)/login/actions'

vi.mock('@/lib/api-server', () => ({
  apiServerFetchRaw: vi.fn(),
  forwardSetCookies: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const { apiServerFetchRaw, forwardSetCookies } = await import('@/lib/api-server')
const { redirect } = await import('next/navigation')

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

const CREDENCIALES = { email: 'ana@aquazaku.com', password: 'secreta123' }

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  // `redirect()` de Next corta la ejecución tirando.
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error('NEXT_REDIRECT')
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('loginAction()', () => {
  describe('validación previa', () => {
    it.each([
      ['sin email', { email: '', password: 'x' }],
      ['sin contraseña', { email: 'a@b.com', password: '' }],
      ['sin nada', { email: '', password: '' }],
    ])('rechaza %s sin molestar a api/', async (_caso, campos) => {
      const estado = await loginAction({}, form(campos))

      expect(estado.error).toBeTruthy()
      expect(apiServerFetchRaw).not.toHaveBeenCalled()
    })
  })

  describe('credenciales correctas', () => {
    beforeEach(() => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, { ok: true }))
    })

    it('pega al endpoint de Better-Auth con el body que espera', async () => {
      await expect(loginAction({}, form(CREDENCIALES))).rejects.toThrow('NEXT_REDIRECT')

      const [path, init] = vi.mocked(apiServerFetchRaw).mock.calls[0]
      expect(path).toBe('/api/auth/sign-in/email')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(init?.body as string)).toEqual(CREDENCIALES)
    })

    // Sin esto el login "funciona" y el usuario vuelve a /login: api/ le dio una
    // sesión que nunca llegó al browser.
    it('reenvía la cookie de sesión al browser', async () => {
      await expect(loginAction({}, form(CREDENCIALES))).rejects.toThrow('NEXT_REDIRECT')

      expect(forwardSetCookies).toHaveBeenCalledOnce()
    })

    // El dashboard vive en `/`: `(app)` es un route group y no agrega segmento.
    // El plan redirigía a `/dashboard`, ruta que ninguna task crea.
    it('manda al dashboard, que esta en la raiz', async () => {
      await expect(loginAction({}, form(CREDENCIALES))).rejects.toThrow('NEXT_REDIRECT')

      expect(redirect).toHaveBeenCalledWith('/')
    })

    it('reenvía la cookie ANTES de redirigir', async () => {
      await expect(loginAction({}, form(CREDENCIALES))).rejects.toThrow('NEXT_REDIRECT')

      const ordenCookie = vi.mocked(forwardSetCookies).mock.invocationCallOrder[0]
      const ordenRedirect = vi.mocked(redirect).mock.invocationCallOrder[0]
      expect(ordenCookie).toBeLessThan(ordenRedirect)
    })
  })

  describe('credenciales incorrectas', () => {
    it('devuelve un error mostrable, no una excepción', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(401, { code: 'UNAUTHENTICATED' }))

      const estado = await loginAction({}, form(CREDENCIALES))

      expect(estado.error).toBeTruthy()
      expect(redirect).not.toHaveBeenCalled()
    })

    // No decir si el email existe o no: eso permite enumerar usuarios.
    it('no revela si el problema fue el email o la contraseña', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(401, { code: 'UNAUTHENTICATED' }))

      const estado = await loginAction({}, form(CREDENCIALES))

      expect(estado.error).not.toMatch(/email|usuario|existe/i)
    })

    it('no reenvía cookies cuando el login falla', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(401))

      await loginAction({}, form(CREDENCIALES))

      expect(forwardSetCookies).not.toHaveBeenCalled()
    })
  })

  describe('usuario desactivado', () => {
    // RN-ACC-05: la sesión es válida pero el usuario está dado de baja. Merece
    // un mensaje propio: reintentar la contraseña no lo va a arreglar.
    it('distingue al usuario inactivo de una credencial mala', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(401, { code: 'USER_INACTIVE' }))

      const estado = await loginAction({}, form(CREDENCIALES))

      expect(estado.error).toMatch(/desactivad/i)
    })
  })

  describe('rate limit', () => {
    // Task 7: 429 con `{ code: 'RATE_LIMITED', reintentarEn }`. Mostrar cuánto
    // falta, no un error genérico que invite a seguir golpeando.
    it('dice cuantos segundos faltan', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(
        respuesta(429, { code: 'RATE_LIMITED', reintentarEn: 90 }),
      )

      const estado = await loginAction({}, form(CREDENCIALES))

      expect(estado.error).toMatch(/90/)
    })

    it('no redirige ni reenvía cookies con rate limit', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(
        respuesta(429, { code: 'RATE_LIMITED', reintentarEn: 30 }),
      )

      await loginAction({}, form(CREDENCIALES))

      expect(redirect).not.toHaveBeenCalled()
      expect(forwardSetCookies).not.toHaveBeenCalled()
    })

    it('aguanta un 429 sin cuerpo util', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 429 }))

      const estado = await loginAction({}, form(CREDENCIALES))

      expect(estado.error).toBeTruthy()
    })
  })

  describe('api/ caida', () => {
    it('devuelve un error mostrable ante un 500', async () => {
      vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(500, {}))

      const estado = await loginAction({}, form(CREDENCIALES))

      expect(estado.error).toBeTruthy()
      expect(redirect).not.toHaveBeenCalled()
    })
  })
})
