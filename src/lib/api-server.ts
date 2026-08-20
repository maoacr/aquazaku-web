import { cookies, headers } from 'next/headers'
import { ApiError } from './errors'
import { logger } from './logger'
import type { Role } from './roles'

/**
 * Punto ÚNICO de contacto entre web/ y api/.
 *
 * El browser nunca habla directo con api/: todo pasa por acá, server-to-server
 * (ADR-0002). Este es también el único archivo del repo donde `fetch()` está
 * permitido — la regla de ESLint lo prohíbe en todos los demás.
 *
 * Ver /frontend/bff-pattern/ para el porqué.
 */

/**
 * Endpoint de sesión que expone api/.
 *
 * Vive en una constante porque el plan de M0 se contradice a sí mismo: el
 * snippet de Task 10 dice `/api/auth/me`, mientras que el código de Task 6 y
 * el doc del patrón BFF dicen `/auth/me`. Manda `/auth/me` (dos fuentes contra
 * una, y una de ellas es el código que realmente se va a ejecutar). Better-Auth
 * monta lo suyo bajo `/api/auth/*`; las rutas propias de api/ van bajo `/auth/*`.
 *
 * Si Task 6 termina exponiéndolo en otro lado, se cambia acá y en ningún otro lugar.
 */
export const AUTH_ME_PATH = '/auth/me'

export interface ServerUser {
  id: string
  roles: Role[]
}

/**
 * Lee la URL interna de api/ en cada llamada, no al importar el módulo.
 *
 * Leerla arriba con `process.env.API_INTERNAL_URL!` tiene dos problemas: la
 * aserción `!` le miente al compilador, y el valor queda congelado en el
 * momento del import (que en Next puede ser build time). Si falta, queremos
 * un error que diga qué hacer, no un `fetch('undefined/auth/me')`.
 */
function resolveApiUrl(): string {
  const url = process.env.API_INTERNAL_URL

  if (!url) {
    throw new Error(
      'API_INTERNAL_URL no está definida: web/ no puede hablar con api/ sin ella. ' +
        'Copiá .env.example a .env.local y completala.',
    )
  }

  // Sin esto, `${url}${path}` produce `http://host//auth/me` cuando la env var
  // viene con barra final. Algunos routers lo toleran; otros devuelven 404.
  return url.replace(/\/+$/, '')
}

export async function apiServerFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiUrl = resolveApiUrl()
  const cookieStore = await cookies()
  const headerStore = await headers()

  const requestId = headerStore.get('x-request-id') ?? crypto.randomUUID()

  // `new Headers(init.headers)` en vez de `{ ...init.headers }`: el spread
  // devuelve `{}` cuando el caller pasa una instancia de Headers o un array de
  // tuplas, y sus headers se perderían en silencio.
  const outgoingHeaders = new Headers(init.headers)

  // Se setean DESPUÉS de los del caller, a propósito: la sesión y la traza no
  // son negociables. Nadie puede pisarlas pasando su propio Cookie.
  outgoingHeaders.set('Cookie', cookieStore.toString())
  outgoingHeaders.set('x-request-id', requestId)

  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: outgoingHeaders,
    // Los datos de api/ dependen de quién pregunta. Cachearlos por defecto
    // serviría la sesión de un usuario a otro.
    cache: init.cache ?? 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    logger.error({ status: res.status, path, requestId }, 'apiServerFetch falló')
    throw new ApiError(res.status, body, { path, requestId })
  }

  const text = await res.text()

  // 204, o un 200 sin cuerpo (típico de un DELETE). `res.json()` pelado tiraría
  // acá un SyntaxError que no dice nada útil.
  if (text.length === 0) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    // api/ respondió 2xx con algo que no es JSON: casi siempre un proxy o un
    // gateway metiendo HTML en el medio. El cuerpo crudo es la pista.
    logger.error({ status: res.status, path, requestId }, 'api/ devolvió un cuerpo no-JSON')
    throw new ApiError(res.status, text, { path, requestId })
  }
}

/**
 * Usuario de la sesión actual, o `null` si no hay sesión.
 *
 * Solo el 401 se traduce a `null` — es el estado normal de "no logueado" y la
 * página redirige a /login. Un 403 significa "hay sesión pero sin permiso" y
 * se propaga: devolverlo como `null` mandaría al usuario a /login en loop
 * cuando en realidad lo que corresponde es una pantalla de sin acceso.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    return await apiServerFetch<ServerUser>(AUTH_ME_PATH)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}
