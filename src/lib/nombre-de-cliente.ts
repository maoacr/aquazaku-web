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

/**
 * El nombre, acomodado a lo que de verdad escribieron — RN-CLI-20.
 *
 * ── El problema ─────────────────────────────────────────────────────────────
 *
 * La base guarda el nombre de DOS formas y no acepta mezclas:
 *
 * · **partido** — `primer_nombre` + `apellidos`, que van juntos o no van
 *   (`clientes_nombre_partido_completo`);
 * · **libre** — `nombre_libre`, una sola cadena.
 *
 * Quien atiende no sabe eso, y no tiene por qué. Escribe «Rosa» en el primer
 * campo porque es lo único que le dijeron, aprieta registrar, y la base
 * rechaza un nombre partido a medias. El formulario le estaba pidiendo que
 * completara un apellido que nadie dio — o sea, que lo inventara.
 *
 * ── Lo que hace ─────────────────────────────────────────────────────────────
 *
 * Si el partido está completo, va partido: es el mejor dato, y habilita buscar
 * por apellido. Si está a medias, lo que haya escrito se junta y viaja como
 * nombre libre — que es exactamente lo que es.
 *
 * El apodo viaja aparte siempre: es otro campo, y el buscador lo mira.
 * Cuando es lo ÚNICO que dieron, también se usa como nombre — «La Flaca» es
 * como la conocen, y es mejor identificador que una ficha sin nombre.
 *
 * Devuelve `null` cuando no escribieron NADA. Ese es el único caso sin salida:
 * `clientes.nombre` es una columna generada `NOT NULL`, y esa venta va sin
 * cliente.
 */
export function nombreParaGuardar(n: Nombre): Partial<Nombre> | null {
  const limpio = (v: string | undefined) => v?.trim() ?? ''

  const libre = limpio(n.nombreLibre)
  const primero = limpio(n.primerNombre)
  const segundo = limpio(n.segundoNombre)
  const apellidos = limpio(n.apellidos)
  const apodo = limpio(n.apodo)

  const conApodo = (base: Partial<Nombre>) => (apodo ? { ...base, apodo } : base)

  if (libre) return conApodo({ nombreLibre: libre })

  if (primero && apellidos) {
    return conApodo({ primerNombre: primero, ...(segundo && { segundoNombre: segundo }), apellidos })
  }

  /*
   * Partido a medias: se junta en el orden en que se escribe un nombre. No se
   * pierde nada —«Rosa» sigue siendo «Rosa»— y deja de pedir el apellido que
   * nadie dio.
   */
  const suelto = [primero, segundo, apellidos].filter(Boolean).join(' ')
  if (suelto) return conApodo({ nombreLibre: suelto })

  if (apodo) return { nombreLibre: apodo, apodo }

  return null
}
