'use server'

import { redirect } from 'next/navigation'
import { conAviso } from '@/lib/avisos-de-navegacion'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError, mensajeRateLimit, validarPasswordNueva } from '@/lib/form-errors'

const RESET_PATH = '/api/auth/reset-password'

export interface ResetPasswordState {
  error?: string
}

export async function resetPasswordAction(
  _previo: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmacion = String(formData.get('confirmacion') ?? '')

  if (!token) {
    return { error: 'El link de recuperación está incompleto. Pida uno nuevo.' }
  }

  const invalida = validarPasswordNueva(password, confirmacion)
  if (invalida) return { error: invalida }

  const res = await apiServerFetchRaw(RESET_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword: password }),
  })

  if (!res.ok) {
    const { reintentarEn } = await cuerpoDeError(res)

    if (res.status === 429) return { error: mensajeRateLimit(reintentarEn) }

    // El caso más común no es un ataque: es alguien que abrió el correo dos
    // días después. El token vive en `verifications` con vencimiento y uso único.
    return {
      error: 'El link de recuperación venció o ya se usó. Pida uno nuevo desde “Olvidé mi contraseña”.',
    }
  }

  // No se reenvía cookie: resetear NO deja la sesión abierta. Además api/ borra
  // todas las sesiones del usuario, que es el punto de recuperar una cuenta.
  redirect(conAviso('/login', 'password-reset'))
}
