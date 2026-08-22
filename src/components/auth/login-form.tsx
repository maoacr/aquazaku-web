'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { type LoginState, loginAction } from '@/app/(auth)/login/actions'

const ESTADO_INICIAL: LoginState = {}

export function LoginForm() {
  const [estado, enviar, pendiente] = useActionState(loginAction, ESTADO_INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <h1 className="aq-titulo-seccion text-principal">Iniciar sesión</h1>

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
          className="aq-campo"
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
          className="aq-campo"
        />
      </label>

      {/* `disabled` mientras corre evita el doble submit, que en este endpoint
          gasta dos intentos del rate limit por un solo click apurado. */}
      <button
        type="submit"
        disabled={pendiente}
        className="aq-boton aq-boton-primario aq-boton-grande"
      >
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>

      <Link href="/forgot-password" className="text-sm text-secundario underline">
        ¿Olvidó su contraseña?
      </Link>
    </form>
  )
}
