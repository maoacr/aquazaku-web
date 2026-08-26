import { cookies } from 'next/headers'

/**
 * Si el menú lateral está desplegado o colapsado a un riel de iconos.
 *
 * ── Por qué en cookie y no en `localStorage` ────────────────────────────────
 *
 * Es exactamente el mismo problema que resolvió el tema. Con `localStorage`, el
 * servidor no sabe la preferencia: manda el menú desplegado, y al hidratar se
 * colapsa de golpe. Ese salto es peor que no tener la función — pasa en CADA
 * navegación, y encima corre el contenido 160 px a la izquierda.
 *
 * Con una cookie el estado viaja en el HTML inicial y la primera pintura ya es
 * la correcta, sin script de bloqueo.
 *
 * **Solo aplica en escritorio.** En teléfono el menú es un cajón que se
 * desliza: no hay riel que colapsar, y el botón no se muestra.
 */

export type EstadoDelMenu = 'desplegado' | 'colapsado'

export const COOKIE_MENU = 'aquazaku_menu'

/** Un año. Es una preferencia de quien usa el sistema, no una sesión. */
export const MAX_EDAD_MENU = 60 * 60 * 24 * 365

export function esEstadoValido(valor: unknown): valor is EstadoDelMenu {
  return valor === 'desplegado' || valor === 'colapsado'
}

/**
 * El estado guardado. Por defecto **desplegado**.
 *
 * Quien entra por primera vez tiene que ver los nombres de los módulos: un riel
 * de iconos es cómodo para quien ya sabe dónde está cada cosa, y adivinanza
 * para quien no.
 */
export async function leerEstadoDelMenu(): Promise<EstadoDelMenu> {
  const valor = (await cookies()).get(COOKIE_MENU)?.value

  return esEstadoValido(valor) ? valor : 'desplegado'
}
