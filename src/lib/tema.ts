import { cookies } from 'next/headers'

/**
 * El tema de la interfaz.
 *
 * `sistema` no es "ninguno": es una elección explícita de seguir al sistema
 * operativo. Sin ese tercer valor, quien elige claro y después cambia de idea no
 * tiene forma de volver a "lo que diga el sistema" — solo puede quedarse en uno
 * de los dos.
 */
export type Tema = 'claro' | 'oscuro' | 'sistema'

export const TEMAS: readonly Tema[] = ['claro', 'oscuro', 'sistema'] as const

export const COOKIE_TEMA = 'aquazaku_tema'

/** Un año: es una preferencia, no una sesión. */
export const MAX_EDAD_TEMA = 60 * 60 * 24 * 365

export function esTemaValido(valor: unknown): valor is Tema {
  return typeof valor === 'string' && (TEMAS as readonly string[]).includes(valor)
}

/**
 * Lee el tema de la cookie.
 *
 * **No se confía en el valor.** La cookie la escribe el cliente y puede llegar
 * con cualquier cosa: se normaliza a `sistema`, que es el default seguro —
 * seguir al sistema operativo nunca deja a nadie con una pantalla ilegible.
 *
 * Nótese que un valor inválido NO es un error: alguien con una cookie vieja de
 * una versión anterior tiene que poder entrar igual.
 */
export async function leerTema(): Promise<Tema> {
  const valor = (await cookies()).get(COOKIE_TEMA)?.value

  return esTemaValido(valor) ? valor : 'sistema'
}

/**
 * Qué valor va en el atributo `data-tema` del `<html>`.
 *
 * ── Las tres ramas, y por qué `claro` SÍ escribe atributo ───────────────────
 *
 * | Tema      | Atributo             | Por qué |
 * |-----------|----------------------|---------|
 * | `oscuro`  | `data-tema="oscuro"` | Activa el bloque oscuro de los tokens |
 * | `claro`   | `data-tema="claro"`  | **Para GANARLE a la preferencia del sistema** |
 * | `sistema` | ninguno              | Deja que decida `prefers-color-scheme` |
 *
 * La rama de `claro` es la que se presta a error, y el plan de esta fase la
 * tenía mal: decía que `claro` no escribiera nada.
 *
 * Sin atributo, `:root:not([data-tema])` matchea, la media query
 * `prefers-color-scheme: dark` se aplica, y **alguien que eligió claro en un
 * sistema configurado en oscuro vería la app oscura**. Su elección explícita
 * perdería contra el sistema, que es exactamente al revés de lo que significa
 * elegir.
 *
 * El valor `claro` no necesita reglas CSS propias —los tokens base ya son
 * claros— pero el atributo tiene que **existir** para que `:not()` falle.
 */
export function atributoDeTema(tema: Tema): { 'data-tema'?: 'oscuro' | 'claro' } {
  if (tema === 'sistema') return {}
  return { 'data-tema': tema }
}
