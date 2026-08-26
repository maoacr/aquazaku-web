'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError } from '@/lib/form-errors'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'
import type { Role } from '@/lib/roles'

/**
 * Mutaciones de la pantalla de usuarios.
 *
 * Todas pasan por `apiServerFetchRaw` porque acá los status de error son
 * estados normales de pantalla, no excepciones: un 409 `ULTIMO_ADMIN` es un
 * mensaje que el admin tiene que leer, no un error boundary.
 *
 * Ninguna decide permisos. `api/` valida con `requirePermission('usuarios', …)`
 * en cada endpoint (RN-ACC-02); si esta pantalla se equivoca, el peor caso es
 * un mensaje de error, no un dato filtrado.
 */

const RUTA = '/modulos/usuarios'

/** Traduce un fallo de `api/` a algo que el admin pueda accionar. */
async function mensajeDeError(res: Response, generico: string): Promise<string> {
  // Se lee el cuerpo UNA sola vez: un `Response` solo se puede consumir una
  // vez, y clonarlo después de leerlo tira "Body has already been consumed".
  const { code, mensaje } = await cuerpoDeError(res)

  // `api/` ya explica qué hacer en estos casos; repetirlo acá con otras
  // palabras solo genera dos mensajes que se desincronizan.
  if (code === 'ULTIMO_ADMIN' && mensaje) return mensaje
  if (code === 'EMAIL_EN_USO') return 'Ya existe un usuario con ese email.'
  if (code === 'USUARIO_NO_ENCONTRADO') return 'Ese usuario ya no existe.'
  if (res.status === 403) return 'No tiene permiso para hacer esto.'

  return generico
}

export async function crearUsuarioAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const email = String(formData.get('email') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const roles = formData.getAll('roles').map(String) as Role[]

  if (!email || !name || !password) {
    return { error: 'Complete el email, el nombre y la contraseña.' }
  }

  const res = await apiServerFetchRaw('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password, roles }),
  })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos crear el usuario.') }
  }

  revalidatePath(RUTA)
  return exito(`Usuario ${email} creado. Va a tener que cambiar la contraseña al entrar.`)
}

export async function cambiarRolesAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const userId = String(formData.get('userId') ?? '')
  const roles = formData.getAll('roles').map(String) as Role[]

  if (!userId) return { error: 'Falta el usuario.' }

  // PUT y no POST: se manda el conjunto completo de roles, no un agregado.
  const res = await apiServerFetchRaw(`/users/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roles }),
  })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos cambiar los roles.') }
  }

  revalidatePath(RUTA)
  return exito('Roles actualizados. El cambio ya está activo, sin necesidad de volver a entrar.')
}

export async function cambiarEstadoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const userId = String(formData.get('userId') ?? '')
  const status = String(formData.get('status') ?? '')

  if (status !== 'active' && status !== 'inactive') {
    return { error: 'Estado inválido.' }
  }

  const res = await apiServerFetchRaw(`/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos cambiar el estado del usuario.') }
  }

  revalidatePath(RUTA)
  return {
    ok:
      status === 'inactive'
        ? 'Usuario desactivado. Sus sesiones abiertas se cerraron.'
        : 'Usuario reactivado.',
  }
}

/**
 * Restablece la contraseña de un usuario y devuelve la temporal UNA vez.
 *
 * ── Por qué existe, y por qué no muestra la contraseña real ─────────────────
 *
 * `accounts.password` guarda un hash argon2id: el sistema **no tiene** la
 * contraseña de nadie, tiene una huella que sirve para verificar un intento.
 * Mostrar «la contraseña registrada» exigiría dejar de hashear.
 *
 * Y no se haría igual aunque se pudiera. Si el admin ve las contraseñas, el
 * `audit_log` deja de probar nada: «pos@aquazaku.com anuló esta venta» pasaría a
 * significar «alguien que sabía esa clave lo hizo», y esa lista incluye al
 * admin. El módulo de auditoría —la pieza más cara del sistema— quedaría
 * decorativo.
 *
 * Esto resuelve el problema real —que nadie dependa del correo para volver a
 * entrar— sin ese costo: el admin dicta una temporal de viva voz y
 * `mustChangePassword` obliga a cambiarla al entrar. **El admin nunca conoce la
 * contraseña final.**
 */
export interface EstadoDeRestablecer extends EstadoDeFormulario {
  /** Se muestra UNA vez y no se persiste en ningún lado. */
  temporal?: string
}

export async function restablecerPasswordAction(
  _previo: EstadoDeRestablecer,
  formData: FormData,
): Promise<EstadoDeRestablecer> {
  const userId = String(formData.get('userId') ?? '')

  if (!userId) return { error: 'Falta el usuario.' }

  const res = await apiServerFetchRaw(`/users/${userId}/reset-password`, { method: 'POST' })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos restablecer la contraseña.') }
  }

  const { temporal } = (await res.json()) as { temporal: string }

  revalidatePath(`${RUTA}/${userId}`)
  return {
    temporal,
    ok: 'Listo. Dígasela en persona: es de un solo uso y se cambia al entrar.',
  }
}

export type { EstadoDeFormulario }
