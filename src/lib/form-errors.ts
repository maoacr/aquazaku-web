/**
 * Utilidades compartidas por las Server Actions de auth.
 *
 * Todas hablan con `api/` vía `apiServerFetchRaw`, que no tira ante un status
 * de error porque en auth esos status son estados normales de pantalla.
 * Traducirlos a algo que el usuario entienda es lo que vive acá.
 */

/** Longitud mínima de contraseña (spec §5). Debe coincidir con la de `api/`. */
export const LARGO_MINIMO_PASSWORD = 8

export interface CuerpoDeError {
  code?: string
  reintentarEn?: number
}

/**
 * Lee el cuerpo de error sin romperse si viene vacío o no es JSON.
 *
 * Un 429 puede no traer cuerpo, y un proxy caído devuelve HTML. Ninguno de los
 * dos casos justifica una excepción en medio de un login.
 */
export async function cuerpoDeError(res: Response): Promise<CuerpoDeError> {
  try {
    const cuerpo: unknown = await res.json()
    if (typeof cuerpo === 'object' && cuerpo !== null) return cuerpo as CuerpoDeError
  } catch {
    // Sin cuerpo útil: se cae al mensaje genérico.
  }
  return {}
}

/**
 * Mensaje de rate limit.
 *
 * Decir cuánto falta, en vez de un error genérico, evita que el usuario siga
 * golpeando y hunda más su propio contador.
 */
export function mensajeRateLimit(reintentarEn?: number): string {
  return reintentarEn
    ? `Demasiados intentos. Probá de nuevo en ${reintentarEn} segundos.`
    : 'Demasiados intentos. Esperá un momento antes de volver a probar.'
}

/**
 * Valida una contraseña nueva contra su confirmación.
 *
 * Devuelve el mensaje de error, o `null` si está bien. Se valida en `web/`
 * para ahorrar un viaje y dar un mensaje mejor — pero `api/` valida igual por
 * su cuenta, porque esta capa es conveniencia, no barrera.
 */
export function validarPasswordNueva(nueva: string, confirmacion: string): string | null {
  if (nueva.length < LARGO_MINIMO_PASSWORD) {
    return `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`
  }
  if (nueva !== confirmacion) {
    return 'Las contraseñas no coinciden.'
  }
  return null
}

/**
 * URL pública de `web/`, para armar links que vuelvan a esta app.
 *
 * Se lee en cada llamada y se valida, por el mismo motivo que
 * `API_INTERNAL_URL`: una aserción `!` produciría un link `undefined/...` en
 * un correo, que es un error que se descubre tarde y desde afuera.
 */
export function resolveWebUrl(): string {
  const url = process.env.WEB_PUBLIC_URL

  if (!url) {
    throw new Error(
      'WEB_PUBLIC_URL no está definida: sin ella el correo de recuperación llevaría a ningún lado. ' +
        'Copiá .env.example a .env.local y completala.',
    )
  }

  return url.replace(/\/+$/, '')
}
