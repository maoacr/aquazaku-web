import type { Role } from './roles'

/**
 * Formas que devuelve `api/`.
 *
 * Se declaran una sola vez y acá: si cada página redeclarara las suyas, el día
 * que `api/` agregue un campo habría que buscarlo en varios archivos, y el día
 * que lo renombre nadie se enteraría hasta ver la pantalla vacía.
 *
 * Verificadas contra `api/src/modules/users/service.ts` y
 * `api/src/modules/audit/query.ts`.
 */

/** `GET /users` y `GET /users/:id`. */
export interface UsuarioListado {
  id: string
  email: string
  name: string
  status: 'active' | 'inactive'
  mustChangePassword: boolean
  roles: Role[]
  createdAt: string
}

/** Una fila de `GET /audit`. */
export interface RegistroDeAuditoria {
  id: number
  userId: string | null
  /**
   * Nombre resuelto por `api/` con un LEFT JOIN.
   *
   * `null` significa que la cuenta se borró y el registro sobrevivió —
   * `audit_log` no tiene FK a `users` justamente para eso. La pantalla lo
   * muestra como "(cuenta eliminada)", no como un espacio en blanco.
   */
  userName: string | null
  userEmail: string | null
  rolEjercido: string[] | null
  action: string
  resource: string | null
  resourceId: string | null
  result: 'ok' | 'denied'
  requestId: string | null
  ip: string | null
  userAgent: string | null
  payload: unknown
  createdAt: string
}

/** `GET /audit`. */
export interface PaginaDeAuditoria {
  filas: RegistroDeAuditoria[]
  /** `null` significa que no hay más: el botón "cargar más" se oculta. */
  siguienteCursor: number | null
}
