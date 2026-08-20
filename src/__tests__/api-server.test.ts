import { stringifyCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_ME_PATH,
  apiServerFetch,
  apiServerFetchRaw,
  forwardSetCookies,
  getServerUser,
} from '@/lib/api-server'
import type { ServerUser } from '@/lib/api-server'
import { ApiError } from '@/lib/errors'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { cookies, headers } = await import('next/headers')
const { logger } = await import('@/lib/logger')

const API_URL = 'http://localhost:3001'
const WEB_ORIGIN = 'http://localhost:3000'

/** Espía del `set()` del cookie store, para verificar qué se le manda al browser. */
let cookieSet: ReturnType<typeof vi.fn>

/** Stub de `cookies()`: `toString()` es lo que se reenvía, `set()` lo que se emite. */
function stubCookies(serialized: string): void {
  cookieSet = vi.fn()
  vi.mocked(cookies).mockResolvedValue({
    toString: () => serialized,
    set: cookieSet,
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

/** Stub de `headers()` del request entrante. */
function stubHeaders(init: Record<string, string> = {}): void {
  const store = new Headers(init)
  vi.mocked(headers).mockResolvedValue(store as unknown as Awaited<ReturnType<typeof headers>>)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Devuelve el `RequestInit` con el que se llamó a `fetch`. */
function lastInit(): RequestInit {
  const mock = vi.mocked(globalThis.fetch)
  return mock.mock.calls.at(-1)![1] as RequestInit
}

function lastUrl(): string {
  const mock = vi.mocked(globalThis.fetch)
  return mock.mock.calls.at(-1)![0] as string
}

function lastHeaders(): Headers {
  return new Headers(lastInit().headers)
}

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', API_URL)
  vi.stubEnv('WEB_PUBLIC_URL', WEB_ORIGIN)
  vi.stubGlobal('fetch', vi.fn())
  stubCookies('aquazaku_session=abc123')
  stubHeaders()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/**
 * Better-Auth rechaza con 403 `MISSING_OR_NULL_ORIGIN` toda petición que cambie
 * estado y llegue sin `Origin`. `fetch` del lado del servidor no lo manda solo,
 * así que el helper tiene que declararlo.
 *
 * Este caso **rompía todo el login** y no lo veía ningún test: los de `api/`
 * usan `app.inject()`, que no dispara el chequeo, y los de `web/` mockean
 * `fetch`. Vivía justo en la costura entre los dos repos.
 */
describe('header Origin', () => {
  it('lo manda en cada petición', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await apiServerFetch('/ventas')

    expect(lastHeaders().get('Origin')).toBe(WEB_ORIGIN)
  })

  it('también en las mutaciones, que es donde Better-Auth lo exige', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await apiServerFetchRaw('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(lastHeaders().get('Origin')).toBe(WEB_ORIGIN)
    expect(lastHeaders().get('Content-Type')).toBe('application/json')
  })

  it('manda solo el origen, sin path ni query', async () => {
    vi.stubEnv('WEB_PUBLIC_URL', 'https://app.aquazaku.com/algo?x=1')
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await apiServerFetch('/ventas')

    // Un Origin con path no matchea contra `trustedOrigins` y vuelve el 403.
    expect(lastHeaders().get('Origin')).toBe('https://app.aquazaku.com')
  })

  it('el caller NO puede pisarlo: sería hacerse pasar por otro origen', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await apiServerFetch('/ventas', { headers: { Origin: 'http://evil.com' } })

    expect(lastHeaders().get('Origin')).toBe(WEB_ORIGIN)
  })

  it('sin WEB_PUBLIC_URL falla con un mensaje que dice qué hacer', async () => {
    vi.stubEnv('WEB_PUBLIC_URL', '')
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    // Mejor un error accionable en el arranque que un 403 inexplicable al
    // primer login.
    await expect(apiServerFetch('/ventas')).rejects.toThrow(/WEB_PUBLIC_URL/)
  })
})

describe('apiServerFetch()', () => {
  describe('construcción del request', () => {
    it('arma la URL a partir de API_INTERNAL_URL', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas')

      expect(lastUrl()).toBe('http://localhost:3001/ventas')
    })

    it('no duplica la barra si API_INTERNAL_URL termina en /', async () => {
      vi.stubEnv('API_INTERNAL_URL', 'http://localhost:3001/')
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas')

      expect(lastUrl()).toBe('http://localhost:3001/ventas')
    })

    // Sin esto el Server Component pide datos como anónimo y api/ responde 401.
    it('reenvía SIEMPRE las cookies del browser', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas')

      expect(lastHeaders().get('cookie')).toBe('aquazaku_session=abc123')
    })

    it('propaga el x-request-id entrante para poder correlacionar logs', async () => {
      stubHeaders({ 'x-request-id': '550e8400-e29b-41d4-a716-446655440000' })
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas')

      expect(lastHeaders().get('x-request-id')).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('genera un x-request-id cuando el request entrante no trae uno', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas')

      expect(lastHeaders().get('x-request-id')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })

    it('nunca cachea por defecto: los datos de api/ dependen de la sesión', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas')

      expect(lastInit().cache).toBe('no-store')
    })

    it('respeta un cache explícito del caller', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/config', { cache: 'force-cache' })

      expect(lastInit().cache).toBe('force-cache')
    })

    it('conserva method y body del caller', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas/1/anular', {
        method: 'POST',
        body: JSON.stringify({ motivo: 'error de carga' }),
      })

      expect(lastInit().method).toBe('POST')
      expect(lastInit().body).toBe('{"motivo":"error de carga"}')
    })

    it('conserva headers del caller pasados como objeto plano', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas', { headers: { 'Content-Type': 'application/json' } })

      expect(lastHeaders().get('content-type')).toBe('application/json')
    })

    // El spread `{ ...init.headers }` del snippet original descarta en silencio
    // los headers cuando vienen como instancia de Headers. Acá se blinda.
    it('conserva headers del caller pasados como instancia de Headers', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas', {
        headers: new Headers({ 'Content-Type': 'application/json' }),
      })

      expect(lastHeaders().get('content-type')).toBe('application/json')
    })

    it('conserva headers del caller pasados como array de tuplas', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas', { headers: [['Content-Type', 'application/json']] })

      expect(lastHeaders().get('content-type')).toBe('application/json')
    })

    // Un caller no puede hacerse pasar por otra sesión pisando el header.
    it('la cookie de sesión gana sobre un Cookie puesto por el caller', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

      await apiServerFetch('/ventas', { headers: { Cookie: 'aquazaku_session=robada' } })

      expect(lastHeaders().get('cookie')).toBe('aquazaku_session=abc123')
    })
  })

  describe('configuración faltante', () => {
    it('falla con un mensaje accionable si API_INTERNAL_URL no está definida', async () => {
      vi.stubEnv('API_INTERNAL_URL', '')

      await expect(apiServerFetch('/ventas')).rejects.toThrow(/API_INTERNAL_URL/)
    })

    it('no llega a llamar a fetch si falta la configuración', async () => {
      vi.stubEnv('API_INTERNAL_URL', '')

      await expect(apiServerFetch('/ventas')).rejects.toThrow()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })

  describe('respuestas exitosas', () => {
    it('devuelve el JSON parseado', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ id: '1', total: 4500 }))

      await expect(apiServerFetch('/ventas/1')).resolves.toEqual({ id: '1', total: 4500 })
    })

    it('devuelve undefined en un 204 sin cuerpo', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 204 }))

      await expect(apiServerFetch('/ventas/1')).resolves.toBeUndefined()
    })

    it('devuelve undefined en un 200 con cuerpo vacío', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response('', { status: 200 }))

      await expect(apiServerFetch('/ventas/1')).resolves.toBeUndefined()
    })

    // Si api/ devuelve HTML (proxy caído, error de infra), `res.json()` pelado
    // tira un SyntaxError sin contexto. Queremos el cuerpo real en el error.
    it('tira ApiError si un 200 trae un cuerpo que no es JSON', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('<html>gateway</html>', { status: 200 }),
      )

      await expect(apiServerFetch('/ventas')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('respuestas de error', () => {
    it('tira ApiError con el status de api/', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response('sin permiso', { status: 403 }))

      await expect(apiServerFetch('/usuarios')).rejects.toMatchObject({
        status: 403,
        body: 'sin permiso',
      })
    })

    it('el ApiError incluye path y requestId para poder rastrear el log', async () => {
      stubHeaders({ 'x-request-id': 'req-42' })
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response('boom', { status: 500 }))

      await expect(apiServerFetch('/usuarios')).rejects.toMatchObject({
        status: 500,
        path: '/usuarios',
        requestId: 'req-42',
      })
    })

    it('loguea el fallo en vez de tragárselo', async () => {
      stubHeaders({ 'x-request-id': 'req-42' })
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response('boom', { status: 500 }))

      await expect(apiServerFetch('/usuarios')).rejects.toThrow()
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, path: '/usuarios', requestId: 'req-42' }),
        expect.any(String),
      )
    })

    it('deja pasar el error de red sin envolverlo en ApiError', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('fetch failed'))

      await expect(apiServerFetch('/ventas')).rejects.toBeInstanceOf(TypeError)
    })
  })
})

describe('apiServerFetchRaw()', () => {
  // El sign-in necesita el `set-cookie` de la respuesta, y `apiServerFetch`
  // devuelve JSON parseado: el Response ya se consumió. De ahí esta variante.
  it('devuelve el Response sin tocar', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    const res = await apiServerFetchRaw('/api/auth/sign-in/email', { method: 'POST' })

    expect(res).toBeInstanceOf(Response)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('reenvía cookies y x-request-id igual que apiServerFetch', async () => {
    stubHeaders({ 'x-request-id': 'req-7' })
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await apiServerFetchRaw('/api/auth/sign-in/email', { method: 'POST' })

    expect(lastHeaders().get('cookie')).toBe('aquazaku_session=abc123')
    expect(lastHeaders().get('x-request-id')).toBe('req-7')
  })

  // Un 401 en el sign-in es "credenciales inválidas": lo maneja el formulario,
  // no es una excepción. Un 429 es rate limit y hay que leerle el cuerpo.
  it('NO tira ante un status de error: el caller decide', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('nope', { status: 401 }))

    const res = await apiServerFetchRaw('/api/auth/sign-in/email', { method: 'POST' })

    expect(res.status).toBe(401)
  })

  it('falla igual si falta API_INTERNAL_URL', async () => {
    vi.stubEnv('API_INTERNAL_URL', '')

    await expect(apiServerFetchRaw('/x')).rejects.toThrow(/API_INTERNAL_URL/)
  })
})

describe('forwardSetCookies()', () => {
  function conCookies(...cookies: string[]): Response {
    const headers = new Headers()
    for (const c of cookies) headers.append('set-cookie', c)
    return new Response(null, { status: 200, headers })
  }

  // El snippet del plan extraía el valor con una regex y volvía a armar la
  // cookie con atributos hardcodeados. Eso descarta lo que api/ realmente puso
  // y, si algún día cambian `path` o `domain`, el logout deja de borrarla.
  it('reenvía la cookie con los atributos que puso api/, no inventados', async () => {
    await forwardSetCookies(
      conCookies('aquazaku_session=tok.firma; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'),
    )

    expect(cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'aquazaku_session',
        value: 'tok.firma',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 604800,
      }),
    )
  })

  // Better-Auth firma sus cookies: el valor es `token.firma`. Si se partiera
  // por el punto o se re-escapara distinto, la firma dejaría de validar.
  //
  // `parseSetCookie` DECODIFICA el valor (`%3D%3D` → `==`) y `stringifyCookie`
  // lo vuelve a codificar igual. Lo que importa no es la representación
  // intermedia sino que el round-trip sea simétrico: el browser tiene que
  // recibir byte por byte lo que emitió api/. Eso es lo que se prueba acá.
  it.each([
    'aquazaku_session=tok.firma; Path=/',
    'aquazaku_session=a.b.c%3D%3D; Path=/',
    'aquazaku_session=abc%2Fdef%2B123%3D; Path=/; HttpOnly; Secure',
  ])('reemite %s sin alterarlo', async (original) => {
    await forwardSetCookies(conCookies(original))

    const emitida = cookieSet.mock.calls.at(-1)![0] as Parameters<typeof stringifyCookie>[0]
    const reemitida = stringifyCookie(emitida)

    // El par `nombre=valor` es lo que lleva la firma: tiene que salir idéntico.
    expect(reemitida.split('; ')[0]).toBe(original.split('; ')[0])

    // Los atributos se comparan como conjunto: `stringifyCookie` los serializa
    // en su propio orden, y ese orden no es parte del contrato.
    expect(new Set(reemitida.split('; ').slice(1))).toEqual(
      new Set(original.split('; ').slice(1)),
    )
  })

  it('reenvía todas las cookies, no solo la primera', async () => {
    await forwardSetCookies(
      conCookies('aquazaku_session=tok; Path=/', 'otra=x; Path=/'),
    )

    expect(cookieSet).toHaveBeenCalledTimes(2)
  })

  it('no hace nada si la respuesta no trae set-cookie', async () => {
    await forwardSetCookies(conCookies())

    expect(cookieSet).not.toHaveBeenCalled()
  })

  // Una línea vacía es lo único que el parser rechaza. Descartarla en vez de
  // emitir una cookie sin nombre evita ensuciar el response con basura.
  it('descarta una linea de set-cookie que el parser no entiende', async () => {
    await forwardSetCookies(conCookies('', 'aquazaku_session=tok; Path=/'))

    expect(cookieSet).toHaveBeenCalledTimes(1)
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'aquazaku_session' }))
  })

  it('preserva secure cuando api/ lo manda', async () => {
    await forwardSetCookies(conCookies('aquazaku_session=tok; Path=/; Secure; HttpOnly'))

    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({ secure: true }))
  })
})

describe('getServerUser()', () => {
  beforeEach(() => {
    vi.stubEnv('API_INTERNAL_URL', API_URL)
  })

  it('pega contra el endpoint de sesión declarado por api/', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ id: 'u1', roles: ['admin'] }))

    await getServerUser()

    expect(lastUrl()).toBe(`${API_URL}${AUTH_ME_PATH}`)
  })

  // Contrato real de api/, verificado contra `api/src/modules/auth/routes.ts`
  // al cerrarse Task 6. Devuelve todo lo necesario para armar la pantalla en un
  // solo viaje, no solo id y roles.
  it('devuelve el perfil completo que manda api/', async () => {
    const perfil: ServerUser = {
      id: 'u1',
      name: 'Ana',
      email: 'ana@aquazaku.com',
      roles: ['admin', 'contador'],
      permisos: ['auditoria:leer', 'usuarios:crear'],
      mustChangePassword: false,
    }
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(perfil))

    await expect(getServerUser()).resolves.toEqual(perfil)
  })

  it('conserva los permisos ya resueltos por api/', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        id: 'u1',
        name: 'Ana',
        email: 'ana@aquazaku.com',
        roles: ['contador'],
        permisos: ['auditoria:leer'],
        mustChangePassword: false,
      }),
    )

    const user = await getServerUser()

    // api/ resuelve la matriz y la manda lista: web/ no la replica (RN-ACC-02).
    expect(user?.permisos).toEqual(['auditoria:leer'])
  })

  // spec §7.2: en el primer login hay que forzar el cambio de contraseña. Si
  // este campo no llegara tipado a web/, la regla no se puede aplicar.
  it('trae mustChangePassword para poder forzar el primer cambio', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        id: 'u1',
        name: 'Ana',
        email: 'ana@aquazaku.com',
        roles: ['pos'],
        permisos: [],
        mustChangePassword: true,
      }),
    )

    const user = await getServerUser()

    expect(user?.mustChangePassword).toBe(true)
  })

  // 401 es "no hay sesión", un estado normal: la página redirige a /login.
  it('devuelve null cuando api/ responde 401', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('no session', { status: 401 }))

    await expect(getServerUser()).resolves.toBeNull()
  })

  // 403 es "hay sesión pero sin permiso": NO es null, es una pantalla de sin
  // acceso. Tragárselo como null mandaría al usuario a /login en loop.
  it('propaga un 403 en vez de convertirlo en null', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('forbidden', { status: 403 }))

    await expect(getServerUser()).rejects.toMatchObject({ status: 403 })
  })

  it('propaga un 500 en vez de convertirlo en null', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('boom', { status: 500 }))

    await expect(getServerUser()).rejects.toMatchObject({ status: 500 })
  })

  it('propaga un error de red', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('fetch failed'))

    await expect(getServerUser()).rejects.toBeInstanceOf(TypeError)
  })
})
