'use server'

import { redirect } from 'next/navigation'
import { conAviso } from '@/lib/avisos-de-navegacion'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError, mensajeRateLimit, validarPasswordNueva } from '@/lib/form-errors'

/**
 * Este endpoint es NUESTRO, no de Better-Auth: vive bajo `/auth/*`.
 *
 * El plan apuntaba a `/api/auth/change-password` y mandaba solo `{ password }`.
 * Task 7 lo implementó pidiendo también la contraseña actual: sin eso, quien se
 * apodere de una sesión deja al dueño afuera de su cuenta de forma permanente.
 */
const CHANGE_PASSWORD_PATH = '/auth/change-password'

export interface ChangePasswordState {
  error?: string
}

export async function changePasswordAction(
  _previo: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get('currentPassword') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirmacion = String(formData.get('confirmacion') ?? '')

  if (!currentPassword) {
    return { error: 'Escriba su contraseña actual.' }
  }

  if (currentPassword === password) {
    return { error: 'La contraseña nueva tiene que ser distinta de la actual.' }
  }

  const invalida = validarPasswordNueva(password, confirmacion)
  if (invalida) return { error: invalida }

  const res = await apiServerFetchRaw(CHANGE_PASSWORD_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword: password }),
  })

  if (!res.ok) {
    const { reintentarEn } = await cuerpoDeError(res)

    if (res.status === 429) return { error: mensajeRateLimit(reintentarEn) }

    if (res.status === 401) {
      return { error: 'La contraseña actual no es correcta.' }
    }

    return { error: 'No pudimos cambiar la contraseña. Intente de nuevo en un momento.' }
  }

  // Cambiar la contraseña cierra TODAS las sesiones del usuario, incluida esta
  // (Task 7). Es deliberado: si alguien te robó la sesión y recuperás la
  // cuenta, sin eso el atacante se queda adentro. Por lo mismo, mandar al
  // dashboard sería mentir — la sesión ya no existe.
  redirect(conAviso('/login', 'password-changed'))
}
