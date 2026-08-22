import { Boxes, Calculator, Package, ShieldCheck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './roles'

export interface MenuModule {
  id: string
  label: string
  href: string
  /**
   * El icono del menú. **Obligatorio, y a propósito.**
   *
   * Regla de oro del proyecto: un módulo nuevo llega al menú con su icono. No
   * está escrito solo en la documentación —eso se olvida— sino en el tipo: sin
   * `icono`, esto no compila. Es la única forma de que la regla sobreviva a la
   * décima persona que agregue un módulo un viernes.
   *
   * Se guarda el COMPONENTE, no un JSX ya armado: este archivo lo lee tanto el
   * servidor como el cliente, y un elemento de React construido acá no se puede
   * serializar entre los dos.
   */
  icono: LucideIcon
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
  // Los cuatro roles ven el catálogo: un `pos` que no ve precios no puede
  // vender, y el `contador` lo necesita para leer un comprobante (RN-CAT-06).
  {
    id: 'productos',
    label: 'Productos',
    href: '/modulos/productos',
    icono: Package,
    roles: ['admin', 'seller', 'pos', 'contador'],
  },
  // Los cuatro roles ven el stock: el contador necesita el inventario para
  // cerrar los números, y quien vende necesita saber qué hay.
  {
    id: 'stock',
    label: 'Stock',
    href: '/modulos/stock',
    icono: Boxes,
    roles: ['admin', 'seller', 'pos', 'contador'],
  },
  { id: 'usuarios', label: 'Usuarios', href: '/modulos/usuarios', icono: Users, roles: ['admin'] },
  {
    id: 'auditoria',
    label: 'Auditoría',
    href: '/modulos/auditoria',
    icono: ShieldCheck,
    roles: ['admin'],
  },
  {
    id: 'contador-auditoria',
    label: 'Auditoría',
    href: '/contador/auditoria',
    // Distinto del escudo de la auditoría de admin: quien tiene los dos roles
    // ve dos entradas, y el icono es lo primero que las separa.
    icono: Calculator,
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
