import type { Role } from './roles'

export interface MenuModule {
  id: string
  label: string
  href: string
  /** Roles que ven este módulo. Basta con tener UNO de ellos. */
  roles: Role[]
}

/**
 * Catálogo de módulos de M0. Crece con cada milestone.
 *
 * `auditoria` aparece dos veces a propósito: admin y contador miran auditoría
 * con alcances distintos, y cada uno entra por su propia ruta. Un solo módulo
 * compartido obligaría a la página a ramificar por rol, que es justo lo que
 * el modelo de alcances resuelve del lado de api/.
 */
export const ALL_MODULES: MenuModule[] = [
  { id: 'usuarios', label: 'Usuarios', href: '/modulos/usuarios', roles: ['admin'] },
  { id: 'auditoria', label: 'Auditoría', href: '/modulos/auditoria', roles: ['admin'] },
  {
    id: 'contador-auditoria',
    label: 'Auditoría',
    href: '/contador/auditoria',
    roles: ['contador'],
  },
]

/**
 * Módulos visibles para un usuario, dada la lista completa de sus roles.
 *
 * Devuelve la UNIÓN: los roles no se excluyen entre sí y no hay switch-role
 * (RN-ACC-01). Alguien con `admin` y `contador` ve los módulos de ambos.
 *
 * Esto es COSMÉTICA, no control de acceso. Ocultar el link no protege el dato:
 * cada endpoint de api/ valida permisos por su cuenta con `requirePermission`
 * (RN-ACC-02). Si esta función tuviera un bug, se vería un link de más — no se
 * filtraría información.
 */
export function computeVisibleModules(roles: Role[]): MenuModule[] {
  return ALL_MODULES.filter((modulo) => modulo.roles.some((rol) => roles.includes(rol)))
}
