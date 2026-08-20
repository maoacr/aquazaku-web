'use server'

import { redirect } from 'next/navigation'
import { apiServerFetchRaw, forwardSetCookies } from '@/lib/api-server'
import { cuerpoDeError, mensajeRateLimit } from '@/lib/form-errors'

/** Endpoint de Better-Auth. Vive bajo `/api/auth/*`, que es su namespace. */
const SIGN_IN_PATH = '/api/auth/sign-in/email'

/**
 * Estado del formulario, para `useActionState`.
 *
 * El valor que devuelve una Server Action solo llega a la pantalla si el
 * componente la consume con `useActionState`. Un `<form action={fn}>` a secas
 * descarta el retorno: el error existiría en el servidor y el usuario no vería
 * nada.
 */
export interface LoginState {
  error?: string
}

export async function loginAction(_previo: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  // Se corta acá para no gastar un intento del rate limit en un formulario
  // que ni siquiera está completo.
  if (!email || !password) {
    return { error: 'Completá tu email y tu contraseña.' }
  }

  const res = await apiServerFetchRaw(SIGN_IN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const { code, reintentarEn } = await cuerpoDeError(res)

    if (res.status === 429) {
      return { error: mensajeRateLimit(reintentarEn) }
    }

    // RN-ACC-05: la contraseña puede estar bien y el usuario seguir sin poder
    // entrar. Reintentar no lo arregla, así que merece su propio mensaje.
    if (code === 'USER_INACTIVE') {
      return { error: 'Tu usuario está desactivado. Hablá con un administrador.' }
    }

    // Un mensaje único para email inexistente y contraseña incorrecta: si
    // difirieran, cualquiera podría averiguar qué emails están registrados.
    if (res.status === 401) {
      return { error: 'Credenciales inválidas.' }
    }

    return { error: 'No pudimos procesar el ingreso. Probá de nuevo en un momento.' }
  }

  // Primero la cookie, después el redirect. Al revés, api/ habría creado la
  // sesión y el browser nunca se enteraría: el usuario volvería a /login.
  await forwardSetCookies(res)

  // El dashboard está en `/`, no en `/dashboard`: `(app)` es un route group y
  // no agrega segmento a la URL.
  redirect('/')
}
