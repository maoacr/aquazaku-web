/**
 * Contexto de trazabilidad que acompaña al error. El `requestId` es el mismo
 * que viajó en `x-request-id` hacia api/, así que con él se encuentra la otra
 * mitad de la historia en los logs del backend.
 */
export interface ApiErrorContext {
  path?: string
  requestId?: string
}

/**
 * Falla de una llamada a api/ a través de `apiServerFetch`.
 *
 * El `status` es lo que decide qué hace la UI (ver /frontend/bff-pattern/):
 * 401 → redirect a /login · 403 → pantalla de sin acceso · 5xx → error boundary.
 */
export class ApiError extends Error {
  readonly status: number
  readonly body: string
  readonly path?: string
  readonly requestId?: string
  /**
   * Lo único del error que sobrevive el viaje al browser.
   *
   * Next borra `message` y `stack` en producción —para no filtrar detalles del
   * servidor— y conserva `digest`. Sin esto, el error boundary no puede
   * distinguir un 403 de una caída de `api/`, y le mostraría a un contador
   * "algo salió mal" cuando lo correcto es decirle que no tiene acceso.
   */
  readonly digest: string

  constructor(status: number, body: string, context: ApiErrorContext = {}) {
    super(`API error ${status}${context.path ? ` en ${context.path}` : ''}: ${body}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.path = context.path
    this.requestId = context.requestId
    this.digest = digestDeStatus(status, context.requestId)
  }
}

/** Prefijo de los digests que emite `ApiError`, para reconocerlos en el boundary. */
export const DIGEST_API = 'aquazaku-api'

/**
 * El digest lleva DOS cosas, y por razones distintas.
 *
 * El **status** porque es lo único con lo que el error boundary puede decidir
 * qué mostrar: Next borra `message` y `stack` en producción y solo conserva
 * esto.
 *
 * El **requestId** porque sin él el código que se le da a soporte no identifica
 * nada. `aquazaku-api:500` es el mismo string para todas las fallas del
 * sistema: alguien lo reporta, soporte lo busca en los logs y encuentra
 * cuatrocientas. Con el `requestId` —el mismo que viajó en `x-request-id` hacia
 * api/— se encuentra **esa** petición y la otra mitad de la historia.
 */
export function digestDeStatus(status: number, requestId?: string): string {
  return requestId ? `${DIGEST_API}:${status}:${requestId}` : `${DIGEST_API}:${status}`
}

/** Extrae el status desde el `digest`, que es lo único que llega al cliente. */
export function statusDesdeDigest(digest: string | undefined): number | null {
  if (!digest?.startsWith(`${DIGEST_API}:`)) return null

  // El digest es `aquazaku-api:<status>[:<requestId>]`. `split` y no `slice`:
  // desde que el requestId viaja adentro, cortar por posición se lleva las dos
  // cosas juntas y `Number` devuelve `NaN`.
  const status = Number(digest.split(':')[1])

  return Number.isFinite(status) ? status : null
}

/**
 * El identificador que se le muestra a quien reporta una falla.
 *
 * Es el `requestId` solo, sin el status: no dice «500» —que a la persona no le
 * significa nada y R52 no quiere en pantalla— y sí permite encontrar la
 * petición exacta en los logs de api/.
 */
export function codigoDeSoporte(digest: string | undefined): string | null {
  if (!digest?.startsWith(`${DIGEST_API}:`)) return null

  return digest.split(':')[2] ?? null
}
