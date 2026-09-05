'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { type LoginState, loginAction } from '@/app/(auth)/login/actions'

const ESTADO_INICIAL: LoginState = {}

export function LoginForm({ aviso }: { aviso?: string }) {
  const [estado, enviar, pendiente] = useActionState(loginAction, ESTADO_INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <h1 className="aq-titulo-seccion text-principal">Iniciar sesión</h1>

      {/*
        El aviso que dejó la pantalla anterior — cambiar o restablecer la
        contraseña te devuelve acá.

        Va con `role="status"` y no con `role="alert"`: es una confirmación, no
        un problema. `alert` interrumpe lo que el lector de pantalla esté
        diciendo, y esto no merece esa urgencia.

        Y NO es un toast, a propósito: `avisos.ts` reserva los toast para lo que
        no hace falta volver a leer. Esto explica por qué estás mirando un login
        y qué hacer ahora. Irse solo a los cuatro segundos, mientras alguien
        escribe su correo, es dejar de servir justo cuando hace falta.
      */}
      {aviso && (
        <p role="status" className="rounded-lg border border-exito-borde bg-exito-fondo px-3 py-2 text-sm text-exito-texto">
          {aviso}
        </p>
      )}

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
