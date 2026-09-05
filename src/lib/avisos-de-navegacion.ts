/**
 * Los avisos que sobreviven a un `redirect`.
 *
 * ── El problema que resuelven ───────────────────────────────────────────────
 *
 * Un toast vive en la página que lo dispara. Cuando una acción termina
 * mandándote a OTRA pantalla —cambiar la contraseña te devuelve al login— no hay
 * dónde mostrarlo: la página que sabía qué pasó ya no existe.
 *
 * La señal viaja en la URL, y la página destino la traduce.
 *
 * ── Por qué el vocabulario vive en UN archivo ───────────────────────────────
 *
 * Ya existía el emisor: `change-password` redirigía a `/login?toast=…` desde el
 * primer día. **Nadie había construido el receptor**, así que la señal se mandó
 * al vacío durante meses sin que nada fallara — ni un test, ni un tipo, ni un
 * log. Simplemente no aparecía nada, y eso se lee como «no está implementado».
 *
 * Con las claves acá, mandar una que nadie sabe leer es un error de tipos.
 *
 * ── No es un toast, y es a propósito ────────────────────────────────────────
 *
 * `avisos.ts` fija la regla: un toast es para lo que no hace falta volver a
 * leer. Esto es lo contrario — le explica a alguien por qué está mirando un
 * login y qué tiene que hacer ahora. Desaparecer a los cuatro segundos, mientras
 * escribe su correo, es dejar de servir justo cuando lo necesita.
 */

export const AVISOS = {
  'password-changed': 'Su contraseña se cambió. Entre con la nueva.',
  'password-reset': 'Su contraseña se restableció. Entre con la nueva.',
} as const

export type ClaveDeAviso = keyof typeof AVISOS

/** El destino con su aviso. Tiparlo impide mandar una clave que nadie lee. */
export function conAviso(destino: string, clave: ClaveDeAviso): string {
  return `${destino}?aviso=${clave}`
}

/**
 * Traduce lo que venga en la URL.
 *
 * Devuelve `undefined` para cualquier cosa que no esté en la tabla. Eso no es
 * prolijidad: el valor lo escribe quien arma el enlace, y **cualquiera puede
 * armar uno**. Sin esta tabla, `/login?aviso=Su+cuenta+fue+bloqueada` mostraría
 * ese texto con la tipografía del sistema, y se leería como si lo dijera
 * Aquazaku.
 */
export function leerAviso(valor: string | string[] | undefined): string | undefined {
  if (typeof valor !== 'string') return undefined
  return AVISOS[valor as ClaveDeAviso]
}
