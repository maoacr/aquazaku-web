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

  constructor(status: number, body: string, context: ApiErrorContext = {}) {
    super(`API error ${status}${context.path ? ` en ${context.path}` : ''}: ${body}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.path = context.path
    this.requestId = context.requestId
  }
}
