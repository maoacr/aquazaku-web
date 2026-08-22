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
 * ── El activo no es azul, y el arte de referencia tiene razón ───────────────
 *
 * D2 pedía `bg-accion` + `text-invertido` para el módulo activo. El arte
 * (`claude-design/disenos/Panel de planta`) usa otra cosa: teal `#12525C` con
 * una barra aqua de 3 px a la izquierda.
 *
 * Y es mejor. El azul de acción es el color de los BOTONES; usarlo para «estás
 * acá» mezcla acción con ubicación y deja al menú compitiendo con el botón
 * primario de la pantalla. Teal con barra dice ubicación y nada más.
 *
 * La barra tiene otra ventaja: es un canal de FORMA, no solo de color. El
 * módulo activo se distingue en escala de grises, igual que los estados del
 * semáforo — la misma idea de R40, aplicada a la navegación.
 *
 * El hover es el realce aqua al 10 % del arte. Sobre el panel oscuro se lee sin
 * competir con el activo, que además tiene la barra.
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
      className={`flex min-h-11 items-center gap-2.5 border-l-[3px] py-2 pl-3 pr-3 text-[14px] transition-colors motion-reduce:transition-none ${
        activo
          ? 'border-menu-barra bg-menu-activo font-semibold text-menu-texto'
          : 'border-transparent text-menu-apagado hover:bg-menu-realce hover:text-menu-texto'
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
