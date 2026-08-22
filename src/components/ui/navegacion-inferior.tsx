'use client'

import { Home, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type MenuModule, computeVisibleModules } from '@/lib/modules'
import type { Role } from '@/lib/roles'
import { esElModuloActivo } from './enlace-de-menu'

/**
 * La navegación de teléfono: una barra abajo, donde llega el pulgar.
 *
 * ── Por qué abajo y no solo en el cajón ─────────────────────────────────────
 *
 * Con el cajón como única navegación, moverse entre módulos son tres gestos:
 * abrir, elegir, y que se cierre. En un mostrador eso se hace decenas de veces
 * por turno. Abajo es **un toque**, y encima es la zona que el pulgar alcanza
 * sin recolocar la mano — la parte de arriba de un teléfono grande no se llega
 * sin hacer malabares.
 *
 * El cajón no desaparece: sigue siendo donde vive todo. Esta barra es el atajo a
 * lo que más se usa.
 *
 * ── El desborde ─────────────────────────────────────────────────────────────
 *
 * Cinco ranuras es el máximo que entra a 375 px conservando los 44 px de
 * objetivo táctil. Quien ve cuatro módulos o menos los ve todos; a quien ve más
 * —un admin con varios roles ve seis entradas— la última ranura se le convierte
 * en «Más» y abre el cajón.
 *
 * Se prefiere eso a apretar seis iconos: una barra donde no se le puede pegar a
 * nada es peor que una con un botón extra.
 */
export function NavegacionInferior({
  roles,
  onAbrirCajon,
}: {
  /**
   * Los ROLES, no los módulos ya resueltos — y eso no es un detalle.
   *
   * `MenuModule.icono` es un componente, o sea una función. Un componente de
   * servidor **no puede pasarle una función** a uno de cliente: React no la sabe
   * serializar y la pantalla entera falla con «Functions cannot be passed
   * directly to Client Components».
   *
   * Los roles son texto y cruzan sin problema. Este componente resuelve sus
   * módulos importando `computeVisibleModules`, que del lado del cliente sí
   * tiene los iconos.
   *
   * Los tests no atrapan esto: renderizan todo en un proceso, sin frontera.
   */
  roles: Role[]
  /** Abre el cajón, que es donde está el resto. */
  onAbrirCajon: () => void
}) {
  const ruta = usePathname()
  const { directos, hayMas } = repartir(computeVisibleModules(roles))

  return (
    <nav
      aria-label="Navegación principal"
      style={{ gridArea: 'pie' }}
      /*
        `pb-[env(safe-area-inset-bottom)]`: en un iPhone con barra de gestos, sin
        esto la última fila de iconos queda debajo de ella y no se puede tocar.
      */
      className="aq-panel-marca mx-3 mb-3 flex items-stretch rounded-xl px-1 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <Ranura href="/" etiqueta="Inicio" activo={esElModuloActivo(ruta, '/')}>
        <Home aria-hidden className="size-5 shrink-0" />
      </Ranura>

      {directos.map((modulo) => (
        <Ranura
          key={modulo.id}
          href={modulo.href}
          etiqueta={modulo.label}
          activo={esElModuloActivo(ruta, modulo.href)}
        >
          <modulo.icono aria-hidden className="size-5 shrink-0" />
        </Ranura>
      ))}

      {hayMas ? (
        <button
          type="button"
          onClick={onAbrirCajon}
          className={`${ESTILO_DE_RANURA} text-secundario`}
          aria-label="Ver todos los módulos"
        >
          <MoreHorizontal aria-hidden className="size-5 shrink-0" />
          <span className="text-[11px] leading-none">Más</span>
        </button>
      ) : null}
    </nav>
  )
}

/**
 * Cuántos módulos entran directos y si hace falta «Más».
 *
 * Se exporta para poder probarlo sin renderizar: el reparto es la única lógica
 * de este componente y es donde puede haber un error de borde — mostrar «Más»
 * cuando no sobra nada, o esconder un módulo sin ofrecer cómo llegar.
 */
export function repartir(modules: MenuModule[]): {
  directos: MenuModule[]
  hayMas: boolean
} {
  // Cinco ranuras contando Inicio, así que cuatro módulos entran directos.
  const CUPO = 4

  if (modules.length <= CUPO) return { directos: modules, hayMas: false }

  // Si sobra aunque sea uno, la última ranura la ocupa «Más».
  return { directos: modules.slice(0, CUPO - 1), hayMas: true }
}

const ESTILO_DE_RANURA =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2'

function Ranura({
  href,
  etiqueta,
  activo,
  children,
}: {
  href: string
  etiqueta: string
  activo: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={`${ESTILO_DE_RANURA} ${
        activo ? 'aq-menu-vidrio font-semibold text-principal' : 'text-secundario'
      }`}
    >
      {children}
      {/*
        La etiqueta va siempre, no solo en el activo. Un icono solo obliga a
        adivinar, y «Auditoría» y «Usuarios» no tienen un icono que se entienda
        sin nombre. Once píxeles alcanzan para una palabra corta debajo.
      */}
      <span className="max-w-full truncate text-[11px] leading-none">{etiqueta}</span>
    </Link>
  )
}
