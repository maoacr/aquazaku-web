'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import {
  type ForgotPasswordState,
  forgotPasswordAction,
} from '@/app/(auth)/forgot-password/actions'
import { FormError } from './form-error'

const ESTADO_INICIAL: ForgotPasswordState = {}

export function ForgotPasswordForm() {
  const [estado, enviar, pendiente] = useActionState(forgotPasswordAction, ESTADO_INICIAL)

  // El mismo mensaje exista o no el email: si difirieran, este formulario
  // serviría para averiguar qué direcciones están registradas.
  if (estado.enviado) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="aq-titulo-seccion text-principal">Revise su correo</h1>
        <p role="status" className="text-sm text-secundario">
          Si ese email tiene una cuenta, le mandamos un link para crear una contraseña nueva.
          El link vence, así que usalo pronto.
        </p>
        <Link href="/login" className="text-sm text-tenue underline">
          Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <h1 className="aq-titulo-seccion text-principal">Recuperar contraseña</h1>

      <FormError id="forgot-error">{estado.error}</FormError>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby={estado.error ? 'forgot-error' : undefined}
          className="aq-campo"
        />
      </label>

      <button
        type="submit"
        disabled={pendiente}
        className="aq-boton aq-boton-primario aq-boton-grande"
      >
        {pendiente ? 'Enviando…' : 'Enviarme el link'}
      </button>

      <Link href="/login" className="text-sm text-tenue underline">
        Volver a iniciar sesión
      </Link>
    </form>
  )
}
