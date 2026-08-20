/**
 * Los cuatro roles del sistema. `contador` se agregó para temas tributarios
 * (DIAN) y no es un sub-caso de `admin`: ve auditoría por su propia puerta.
 *
 * Un usuario puede tener N roles activos SIMULTÁNEAMENTE. No existe
 * "rol actual" ni switch-role en ningún nivel (RN-ACC-01).
 */
export type Role = 'admin' | 'seller' | 'pos' | 'contador'

/**
 * Los mismos cuatro, como valor.
 *
 * El tipo solo existe en compilación: para pintar checkboxes hace falta una
 * lista de verdad. Se deriva del tipo con `satisfies`, así agregar un rol al
 * `type` sin sumarlo acá es un error de compilación y no una casilla que nadie
 * ve en la pantalla.
 */
export const ROLES_DISPONIBLES = ['admin', 'seller', 'pos', 'contador'] as const satisfies readonly Role[]
