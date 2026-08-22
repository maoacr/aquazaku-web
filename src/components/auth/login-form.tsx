'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { type LoginState, loginAction } from '@/app/(auth)/login/actions'

const ESTADO_INICIAL: LoginState = {}

export function LoginForm() {
  const [estado, enviar, pendiente] = useActionState(loginAction, ESTADO_INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>

      {/* `role="alert"` hace que un lector de pantalla lo anuncie apenas
          aparece, sin que el usuario tenga que ir a buscarlo. */}
      {estado.error && (
        <p id="login-error" role="alert" className="text-sm text-error-texto">
          {estado.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby={estado.error ? 'login-error' : undefined}
          className="rounded border border-fuerte p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-describedby={estado.error ? 'login-error' : undefined}
          className="rounded border border-fuerte p-2"
        />
      </label>

      {/* `disabled` mientras corre evita el doble submit, que en este endpoint
          gasta dos intentos del rate limit por un solo click apurado. */}
      <button
        type="submit"
        disabled={pendiente}
        className="h-14 rounded-md bg-accion px-5 font-semibold text-invertido hover:bg-accion-hover disabled:opacity-50"
      >
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>

      <Link href="/forgot-password" className="text-sm text-secundario underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  )
}
