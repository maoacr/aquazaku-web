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
    this.digest = digestDeStatus(status)
  }
}

/** Prefijo de los digests que emite `ApiError`, para reconocerlos en el boundary. */
export const DIGEST_API = 'aquazaku-api'

export function digestDeStatus(status: number): string {
  return `${DIGEST_API}:${status}`
}

/** Extrae el status desde el `digest`, que es lo único que llega al cliente. */
export function statusDesdeDigest(digest: string | undefined): number | null {
  if (!digest?.startsWith(`${DIGEST_API}:`)) return null

  const status = Number(digest.slice(DIGEST_API.length + 1))
  return Number.isFinite(status) ? status : null
}
