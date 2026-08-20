/**
 * Los cuatro roles del sistema. `contador` se agregó para temas tributarios
 * (DIAN) y no es un sub-caso de `admin`: ve auditoría por su propia puerta.
 *
 * Un usuario puede tener N roles activos SIMULTÁNEAMENTE. No existe
 * "rol actual" ni switch-role en ningún nivel (RN-ACC-01).
 */
export type Role = 'admin' | 'seller' | 'pos' | 'contador'
