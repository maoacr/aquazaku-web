'use server'

import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError, mensajeRateLimit, resolveWebUrl } from '@/lib/form-errors'

/**
 * Endpoint real de Better-Auth.
 *
 * El plan decía `/api/auth/forgot-password`, que no existe. Task 7 lo dejó como
 * `request-password-reset`, con body `{ email, redirectTo }`.
 */
const REQUEST_RESET_PATH = '/api/auth/request-password-reset'

export interface ForgotPasswordState {
  error?: string
  enviado?: boolean
}

export async function forgotPasswordAction(
  _previo: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email) {
    return { error: 'Escriba su email.' }
  }

  const res = await apiServerFetchRaw(REQUEST_RESET_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      // ADR-0002: el link del correo trae al usuario a `web/`. Better-Auth por
      // defecto apunta a `api/`, que haría al browser hablar con el backend.
      redirectTo: `${resolveWebUrl()}/reset-password`,
    }),
  })

  // El rate limit sí se informa: no revela nada sobre el email y evita que la
  // persona siga golpeando. Recuperación es más estricta que login (3 vs 5).
  if (res.status === 429) {
    const { reintentarEn } = await cuerpoDeError(res)
    return { error: mensajeRateLimit(reintentarEn) }
  }

  // Para cualquier otro resultado se responde SIEMPRE lo mismo, exista o no el
  // email. Si el mensaje difiriera, el formulario sería un oráculo para
  // averiguar qué direcciones están registradas.
  return { enviado: true }
}
