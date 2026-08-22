'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Un enlace del menú lateral, que sabe si es el módulo donde estás parado.
 *
 * Vive en su propio archivo de cliente porque `usePathname()` es un hook y el
 * armazón es un componente de servidor. Extraerlo es más barato que volver
 * cliente a todo el armazón: así el menú se sigue armando en el servidor y solo
 * este enlace corre en el browser.
 *
 * ── El par fondo/texto ──────────────────────────────────────────────────────
 *
 * `bg-accion` + `text-invertido` es el par del sistema para "azul de acción con
 * texto encima", y queda **reservado para el módulo activo**. Antes se usaba en
 * el `hover` de todos los enlaces, que era el bug: dos enlaces se veían iguales
 * —uno porque estabas ahí, otro porque tenías el mouse encima— y el activo
 * dejaba de significar nada.
 *
 * El hover pasa a `bg-fondo`. El plan pedía `bg-tarjeta`, pero el `<nav>` ya es
 * `bg-tarjeta`: ese hover no se vería. `bg-fondo` es el mismo hover que ya usan
 * los iconos de la cabecera, que está sobre la misma superficie.
 */
export function EnlaceDeMenu({
  href,
  icono,
  children,
}: {
  href: string
  icono?: ReactNode
  children: ReactNode
}) {
  const activo = esElModuloActivo(usePathname(), href)

  return (
    <Link
      href={href}
      // `page` y no `true`: le dice al lector de pantalla que este enlace es la
      // página actual, no que sea un control encendido.
      aria-current={activo ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2.5 rounded-md px-3 text-[14px] ${
        activo
          ? 'bg-accion font-medium text-invertido'
          : 'text-principal hover:bg-fondo hover:text-principal'
      }`}
    >
      {icono}
      {children}
    </Link>
  )
}

/**
 * Un módulo está activo en su propia ruta y en todo lo que cuelga de ella:
 * estando en `/modulos/stock/PACA-20-600`, el activo sigue siendo Stock.
 *
 * La raíz es la excepción y se compara exacta. Con `startsWith`, `/` sería
 * prefijo de todas las rutas y el tablero quedaría activo siempre.
 */
export function esElModuloActivo(rutaActual: string, href: string): boolean {
  if (href === '/') return rutaActual === '/'

  return rutaActual === href || rutaActual.startsWith(`${href}/`)
}
