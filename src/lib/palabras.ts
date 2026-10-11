/**
 * Palabras del dominio que no pluralizan pegando una letra.
 *
 * ── Por qué existe este archivo ─────────────────────────────────────────────
 *
 * «botellón» es aguda y lleva tilde; en plural pasa a grave y la pierde:
 * **botellones**. Sumarle `es` al singular da «botellónes», que no es una
 * palabra.
 *
 * La regla estaba resuelta y explicada en el mensaje de éxito de la
 * desactivación, y mal en el modal que la confirma: la pantalla que se lee
 * ANTES de la acción decía «3 botellónes» y la que se lee DESPUÉS, «3
 * botellones». Dos copias de la misma regla terminan así siempre; la pregunta
 * es solo cuándo.
 *
 * Las palabras regulares no van acá. `base` → `bases` se resuelve pegando una
 * `s` donde se use, y envolver eso solo agregaría una capa que no decide nada.
 */

/** `1 → botellón`, cualquier otro número → `botellones`. */
export function botellon(cantidad: number): string {
  return cantidad === 1 ? 'botellón' : 'botellones'
}
