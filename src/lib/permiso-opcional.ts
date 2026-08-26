import { ApiError } from './errors'

/**
 * Un dato que el tablero muestra **si el rol lo puede ver**.
 *
 * ── Por qué esto no es una tabla de permisos en `web/` ──────────────────────
 *
 * El tablero compone paneles de varios módulos, y no todos los roles ven todos.
 * El `contador` ve la producción pero **no** los tanques; el `seller` no ve
 * ninguno de los dos. Sin esto, pedir `/tanques` como `seller` lanza y la
 * página entera se cae con un 500 — por un panel que ni siquiera correspondía.
 *
 * La salida obvia era copiar la matriz de permisos en `web/` y preguntarle
 * antes de pedir. Sería una segunda fuente de verdad de la cosa más delicada
 * del sistema: el día que la matriz cambie, el tablero seguiría escondiendo —o
 * peor, mostrando— lo que ya no corresponde, y nadie lo notaría porque no
 * fallaría nada.
 *
 * Acá el 403 de `api/` **es** la respuesta. La matriz vive en un solo lugar y
 * la pantalla se entera preguntando, no recordando.
 *
 * :::caution
 * Esto NO es control de acceso, sigue siendo cosmética (RN-ACC-02). Lo que
 * protege el dato es que `api/` respondió 403; acá lo único que se decide es
 * si se dibuja un panel vacío o no se dibuja nada.
 * :::
 *
 * Solo se traga el 403. Un 500 o una caída de `api/` tienen que llegar al error
 * boundary: esconder un panel porque el backend está roto convierte una falla
 * ruidosa en un tablero que miente por omisión.
 */
export async function siPuedeVerlo<T>(pedido: Promise<T>): Promise<T | null> {
  try {
    return await pedido
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null
    throw error
  }
}
