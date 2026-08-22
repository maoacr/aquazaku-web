import { ApiError } from './errors'

/**
 * R52 · Errores sin jerga.
 *
 * ```
 * dado    cualquier fallo que llegue a la pantalla
 * entonces el texto no contiene un código HTTP, «timeout», «null» ni un nombre
 *          de tabla
 * y        hay exactamente un botón primario
 * ```
 *
 * ── Lo que este mapa NO hace ────────────────────────────────────────────────
 *
 * No traduce todo. `api/` ya manda mensajes humanos en español para las
 * violaciones de regla de negocio —«la cantidad tiene que ser mayor que cero»,
 * «no hay unidades suficientes en el lote»— y reemplazarlos por un texto
 * genérico **perdería información**: quien está en el punto de venta necesita
 * saber QUÉ regla frenó la operación, no que «algo salió mal».
 *
 * Así que el mensaje del servidor se usa **solo** para los dos status que lo
 * traen curado: 409 y 422, los que emite `ErrorDeNegocio`. En cualquier otro se
 * ignora el cuerpo, porque un 500 puede traer un stack y un 400 de validación
 * puede traer el nombre de un campo de Zod. Confiar en el cuerpo de esos sería
 * justamente filtrar la jerga que R52 prohíbe.
 */
export interface MensajeDeError {
  /** El título. Dice qué pasó, no cómo se llama el problema. */
  titulo: string
  /** Qué hacer, o qué esperar. */
  detalle: string
  /**
   * La ÚNICA acción primaria. R52 pide un solo botón: dos opciones frente a un
   * error obligan a decidir a alguien que ya está frustrado.
   */
  accion: Accion
  /**
   * Si la operación llegó a ejecutarse o no.
   *
   * `false` significa que se puede reintentar sin miedo a duplicar. Es lo más
   * importante que se le puede decir a quien acaba de perder una venta a medio
   * registrar, y R53 lo pide explícito: no se perdió nada.
   */
  seEjecuto: boolean
}

export type Accion = 'reintentar' | 'entrar' | 'volver' | 'esperar'

/**
 * Los status que `api/` devuelve de verdad, verificados leyendo sus rutas — no
 * una lista de todos los códigos HTTP que existen.
 *
 * `400` es validación de Zod, `401` sin sesión, `403` sin permiso,
 * `404` no existe, `409` conflicto, `422` regla de negocio, `429` demasiados
 * intentos y `500` falla interna.
 */
const POR_STATUS: Record<number, Omit<MensajeDeError, 'detalle'> & { detalle: string }> = {
  400: {
    titulo: 'Faltan datos o están mal escritos',
    detalle: 'Revise los campos marcados e intente de nuevo.',
    accion: 'volver',
    seEjecuto: false,
  },
  401: {
    titulo: 'Se cerró la sesión',
    detalle: 'Por seguridad, la sesión se cierra después de un rato sin actividad.',
    accion: 'entrar',
    seEjecuto: false,
  },
  403: {
    titulo: 'No tiene acceso a esto',
    detalle:
      'Su usuario no tiene permiso para esta acción. Si cree que debería tenerlo, pídale a un administrador que revise sus roles.',
    accion: 'volver',
    seEjecuto: false,
  },
  404: {
    titulo: 'Eso ya no está',
    detalle: 'Puede que lo hayan borrado o que el enlace esté viejo.',
    accion: 'volver',
    seEjecuto: false,
  },
  409: {
    titulo: 'Alguien lo cambió antes',
    detalle: 'Vuelva a cargar la pantalla para ver cómo quedó y decida desde ahí.',
    accion: 'reintentar',
    seEjecuto: false,
  },
  422: {
    titulo: 'No se puede hacer así',
    detalle: 'La operación no cumple una regla del sistema.',
    accion: 'volver',
    seEjecuto: false,
  },
  429: {
    titulo: 'Demasiados intentos seguidos',
    detalle: 'Espere un momento e intente de nuevo.',
    accion: 'esperar',
    seEjecuto: false,
  },
  500: {
    titulo: 'Algo se rompió de nuestro lado',
    detalle: 'No es culpa suya. Intente de nuevo en un momento.',
    accion: 'reintentar',
    seEjecuto: false,
  },
}

/**
 * R53 · Sin conexión.
 *
 * No dice «error de red» ni «timeout»: dice qué pasó y, sobre todo, **que no se
 * perdió nada**. Alguien que acaba de registrar una salida y ve un error asume
 * lo peor —que quedó a medias, que hay que revisar— y esa duda cuesta más que
 * la falla.
 */
const SIN_CONEXION: MensajeDeError = {
  titulo: 'No pudimos conectarnos',
  detalle:
    'No se perdió nada: lo que estaba haciendo no se registró, así que puede intentarlo de nuevo sin que quede duplicado. Si sigue sin funcionar, avise a la planta.',
  accion: 'reintentar',
  seEjecuto: false,
}

/** Los dos status cuyo cuerpo trae un mensaje escrito para una persona. */
const CON_MENSAJE_CURADO = new Set([409, 422])

/**
 * Traduce cualquier fallo a algo que se le pueda mostrar a una persona.
 *
 * Acepta `unknown` a propósito: un `catch` no garantiza que lo atrapado sea un
 * `Error`, y esta función es justamente la frontera donde eso deja de importar.
 */
export function mensajeDeError(error: unknown): MensajeDeError {
  if (!(error instanceof ApiError)) return SIN_CONEXION

  const base = POR_STATUS[error.status]
  if (!base) return POR_STATUS[500]!

  if (!CON_MENSAJE_CURADO.has(error.status)) return { ...base }

  const delServidor = mensajeDelCuerpo(error.body)

  return delServidor ? { ...base, detalle: delServidor } : { ...base }
}

/**
 * Saca el `mensaje` del cuerpo `{ code, mensaje }` que arma `ErrorDeNegocio`.
 *
 * Devuelve `null` ante cualquier duda —cuerpo que no es JSON, sin `mensaje`, o
 * un `mensaje` que no es texto—. Mejor el texto genérico del mapa que arriesgar
 * que se filtre algo que no está escrito para leerse.
 */
function mensajeDelCuerpo(body: string): string | null {
  try {
    const parseado: unknown = JSON.parse(body)
    if (typeof parseado !== 'object' || parseado === null) return null

    const mensaje = (parseado as { mensaje?: unknown }).mensaje

    return typeof mensaje === 'string' && mensaje.trim() ? mensaje : null
  } catch {
    return null
  }
}

/** El texto del único botón, según lo que corresponda hacer. */
export const TEXTO_DE_ACCION: Record<Accion, string> = {
  reintentar: 'Reintentar',
  entrar: 'Volver a entrar',
  volver: 'Volver',
  esperar: 'Reintentar',
}
