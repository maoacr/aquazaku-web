import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changePasswordAction } from '@/app/(auth)/change-password/actions'
import { forgotPasswordAction } from '@/app/(auth)/forgot-password/actions'
import { resetPasswordAction } from '@/app/(auth)/reset-password/actions'

vi.mock('@/lib/api-server', () => ({
  apiServerFetchRaw: vi.fn(),
  forwardSetCookies: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { redirect } = await import('next/navigation')

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

function ultimaLlamada() {
  const [path, init] = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  return { path, body: JSON.parse((init?.body as string) ?? '{}') }
}

beforeEach(() => {
  vi.stubEnv('WEB_PUBLIC_URL', 'http://localhost:3000')
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error('NEXT_REDIRECT')
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('forgotPasswordAction()', () => {
  beforeEach(() => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200))
  })

  it('pega al endpoint real de Better-Auth', async () => {
    await forgotPasswordAction({}, form({ email: 'ana@aquazaku.com' }))

    // El plan decía `/api/auth/forgot-password`, que no existe. Task 7 lo
    // implementó como `request-password-reset`.
    expect(ultimaLlamada().path).toBe('/api/auth/request-password-reset')
  })

  it('manda el redirectTo apuntando a web/, no a api/', async () => {
    await forgotPasswordAction({}, form({ email: 'ana@aquazaku.com' }))

    // ADR-0002: el link del correo tiene que traer al usuario a web/. Si
    // apuntara a api/, el browser hablaría directo con el backend.
    expect(ultimaLlamada().body.redirectTo).toBe('http://localhost:3000/reset-password')
  })

  // Si el mensaje difiriera según exista o no el email, el formulario se
  // convierte en un oráculo para enumerar usuarios.
  it.each([
    ['existe', 200],
    ['no existe', 404],
  ])('responde lo mismo exista o no el email (%s)', async (_caso, status) => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(status))

    const estado = await forgotPasswordAction({}, form({ email: 'ana@aquazaku.com' }))

    expect(estado.enviado).toBe(true)
    expect(estado.error).toBeUndefined()
  })

  it('exige un email antes de llamar a api/', async () => {
    const estado = await forgotPasswordAction({}, form({ email: '' }))

    expect(estado.error).toBeTruthy()
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  // Recuperación tiene rate limit más estricto que login (3 vs 5): acá el
  // riesgo es bombardear la casilla de otra persona desde nuestro servidor.
  it('muestra los segundos que faltan ante un 429', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(429, { code: 'RATE_LIMITED', reintentarEn: 45 }),
    )

    const estado = await forgotPasswordAction({}, form({ email: 'ana@aquazaku.com' }))

    expect(estado.error).toMatch(/45/)
    expect(estado.enviado).toBeFalsy()
  })
})

describe('resetPasswordAction()', () => {
  const DATOS = { token: 'tok-123', password: 'nuevaClave1', confirmacion: 'nuevaClave1' }

  beforeEach(() => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200))
  })

  it('manda token y newPassword como los espera api/', async () => {
    await expect(resetPasswordAction({}, form(DATOS))).rejects.toThrow('NEXT_REDIRECT')

    const { path, body } = ultimaLlamada()
    expect(path).toBe('/api/auth/reset-password')
    expect(body).toEqual({ token: 'tok-123', newPassword: 'nuevaClave1' })
  })

  it('manda a login con el aviso de exito', async () => {
    await expect(resetPasswordAction({}, form(DATOS))).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/login?toast=password-reset')
  })

  it('rechaza si la confirmacion no coincide, sin llamar a api/', async () => {
    const estado = await resetPasswordAction({}, form({ ...DATOS, confirmacion: 'otra' }))

    expect(estado.error).toMatch(/coinciden/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  // spec §5: mínimo 8. Validarlo acá evita un viaje y da mejor mensaje.
  it('rechaza una contrasena de menos de 8 caracteres', async () => {
    const estado = await resetPasswordAction(
      {},
      form({ token: 'tok', password: 'corta', confirmacion: 'corta' }),
    )

    expect(estado.error).toMatch(/8/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('rechaza si falta el token', async () => {
    const estado = await resetPasswordAction({}, form({ ...DATOS, token: '' }))

    expect(estado.error).toBeTruthy()
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  // Un token vencido o ya usado no es un error del sistema: es lo más común
  // que le pasa a alguien que abre el correo dos días después.
  it('explica que el link vencio ante un 400', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(400, { code: 'INVALID_TOKEN' }))

    const estado = await resetPasswordAction({}, form(DATOS))

    expect(estado.error).toMatch(/venc|inválido|invalido/i)
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('changePasswordAction()', () => {
  const DATOS = {
    currentPassword: 'vieja123',
    password: 'nuevaClave1',
    confirmacion: 'nuevaClave1',
  }

  beforeEach(() => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200))
  })

  it('pega a nuestro endpoint, no al de Better-Auth', async () => {
    await expect(changePasswordAction({}, form(DATOS))).rejects.toThrow('NEXT_REDIRECT')

    expect(ultimaLlamada().path).toBe('/auth/change-password')
  })

  // Task 7 lo corrigió: sin la contraseña actual, quien se apodere de una
  // sesión deja al dueño afuera de su cuenta de forma permanente.
  it('manda la contrasena actual junto con la nueva', async () => {
    await expect(changePasswordAction({}, form(DATOS))).rejects.toThrow('NEXT_REDIRECT')

    expect(ultimaLlamada().body).toEqual({
      currentPassword: 'vieja123',
      newPassword: 'nuevaClave1',
    })
  })

  // Cambiar la contraseña cierra TODAS las sesiones (Task 7), así que la
  // sesión actual muere también. Mandar al dashboard rebotaría a /login igual.
  it('manda a login, porque el cambio cierra la sesion actual', async () => {
    await expect(changePasswordAction({}, form(DATOS))).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/login?toast=password-changed')
  })

  it('exige la contrasena actual', async () => {
    const estado = await changePasswordAction({}, form({ ...DATOS, currentPassword: '' }))

    expect(estado.error).toBeTruthy()
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('rechaza si la confirmacion no coincide', async () => {
    const estado = await changePasswordAction({}, form({ ...DATOS, confirmacion: 'otra' }))

    expect(estado.error).toMatch(/coinciden/i)
  })

  it('avisa cuando la contrasena actual es incorrecta', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(401, { code: 'INVALID_PASSWORD' }))

    const estado = await changePasswordAction({}, form(DATOS))

    expect(estado.error).toMatch(/actual/i)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rechaza reusar la misma contrasena', async () => {
    const estado = await changePasswordAction(
      {},
      form({ currentPassword: 'misma123', password: 'misma123', confirmacion: 'misma123' }),
    )

    expect(estado.error).toMatch(/distinta|diferente/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })
})
