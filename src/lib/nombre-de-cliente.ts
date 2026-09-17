/**
 * Cómo se nombra a un cliente — RN-CLI-17.
 *
 * ── Por qué vive en `lib/` y no junto a los campos ──────────────────────────
 *
 * `campos-de-nombre.tsx` es `'use client'`. Estas cuatro cosas no son de React:
 * las necesita también `editarClienteAction`, que corre en el servidor, para
 * atajar un nombre incompleto antes de gastar un viaje a `api/`.
 *
 * Es el mismo corte que ya existe entre `formulario.ts` —que importan las
 * Server Actions— y `formulario-cliente.ts`, que se queda con los hooks.
 *
 * La copia de estas reglas en el servidor NO es la barrera: el criterio manda
 * en `exigirNombreCoherente` de `api/` y en cuatro CHECK de la base. Acá se
 * adelanta el rechazo para que quien escribe vea el mensaje sin esperar.
 */

export interface Nombre {
  /** El de un negocio, o el de alguien cargado sin partir. */
  nombreLibre: string
  primerNombre: string
  segundoNombre: string
  apellidos: string
  apodo: string
}

export const NOMBRE_VACIO: Nombre = {
  nombreLibre: '',
  primerNombre: '',
  segundoNombre: '',
  apellidos: '',
  apodo: '',
}

/** Lo que viaja a `api/`: sin las cadenas vacías, que la base rechaza. */
export function soloLoEscrito(n: Nombre): Partial<Nombre> {
  return Object.fromEntries(
    Object.entries(n)
      .map(([campo, valor]) => [campo, valor.trim()])
      .filter(([, valor]) => valor !== ''),
  )
}

/** Si falta lo mínimo para que `api/` lo acepte. Adelanta el rechazo, no lo reemplaza. */
export function faltaElNombre(tipo: 'residencial' | 'comercial', n: Nombre): boolean {
  return tipo === 'comercial'
    ? n.nombreLibre.trim() === ''
    : n.primerNombre.trim() === '' || n.apellidos.trim() === ''
}
