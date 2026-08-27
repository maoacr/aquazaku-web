import {
  Box,
  Boxes,
  Contact,
  Factory,
  Package,
  PackageOpen,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react'
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
 * ── Un módulo por CAPACIDAD, no por rol ─────────────────────────────────────
 *
 * `auditoria` estuvo registrado dos veces —una para admin, otra para contador—
 * con la idea de que cada rol entrara por su propia ruta a un alcance distinto.
 * Nunca fue así: las dos rutas renderizaban el mismo componente con los mismos
 * filtros, y el alcance lo resuelve `api/` con `scopedCondition` a partir de la
 * SESIÓN, no de la ruta (RN-ACC-03). Las dos entradas eran indistinguibles.
 *
 * El síntoma era un menú con «Auditoría» dos veces para quien tiene los dos
 * roles. Y la tentación era arreglarlo filtrando —«si es admin, no muestres el
 * de contador»—, que habría sido peor: mete precedencia entre roles en un
 * sistema donde los roles se SUMAN (RN-ACC-01), y solo arregla este par. El
 * próximo par de roles que comparta una capacidad necesitaría su propia
 * excepción.
 *
 * La regla que evita la clase entera: **una capacidad, una entrada**, con la
 * lista de roles que la ven. Así la unión sigue siendo una unión y no hay nada
 * que deduplicar. Un test verifica que no haya dos módulos con la misma
 * etiqueta ni con la misma ruta.
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
  // Tapas, sellos y bolsas. El `seller` no lo ve: no toca la planta.
  {
    id: 'insumos',
    label: 'Insumos',
    href: '/modulos/insumos',
    icono: PackageOpen,
    roles: ['admin', 'pos', 'contador'],
  },
  // El `seller` no lo ve: no toca la planta. El `contador` sí — necesita saber
  // cuánto se produjo para cerrar los números, aunque no pueda cerrar el día.
  {
    id: 'produccion',
    label: 'Producción',
    href: '/modulos/produccion',
    icono: Factory,
    roles: ['admin', 'pos', 'contador'],
  },
  // Los cuatro roles ven clientes: el `seller` los consigue, el `pos` los
  // atiende en el mostrador y el `contador` los necesita para la cartera.
  {
    id: 'clientes',
    label: 'Clientes',
    href: '/modulos/clientes',
    icono: Contact,
    roles: ['admin', 'seller', 'pos', 'contador'],
  },
  // Los cuatro roles ven ventas, pero no las mismas: `pos` y `seller` ven las
  // propias y el `contador` todas, y eso lo recorta `api/` con la matriz
  // (RN-ACC-03). El menú solo dice quién entra.
  {
    id: 'ventas',
    label: 'Ventas',
    href: '/modulos/ventas',
    icono: Receipt,
    roles: ['admin', 'pos', 'seller', 'contador'],
  },
  // El `seller` los VE y no los opera: quien entrega en la calle trabaja por
  // ruta, y las rutas son M8. Lo dice la matriz, no esta lista.
  {
    id: 'retornables',
    label: 'Retornables',
    href: '/modulos/retornables',
    icono: Box,
    roles: ['admin', 'pos', 'seller', 'contador'],
  },
  { id: 'usuarios', label: 'Usuarios', href: '/modulos/usuarios', icono: Users, roles: ['admin'] },
  // Admin y contador ven la MISMA auditoría. Qué filas trae cada uno lo decide
  // `api/` según la sesión, así que no hay dos pantallas ni dos rutas.
  {
    id: 'auditoria',
    label: 'Auditoría',
    href: '/modulos/auditoria',
    icono: ShieldCheck,
    roles: ['admin', 'contador'],
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
