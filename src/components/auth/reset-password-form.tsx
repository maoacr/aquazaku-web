'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { type ResetPasswordState, resetPasswordAction } from '@/app/(auth)/reset-password/actions'
import { FormError } from './form-error'
import { PasswordFields } from './password-fields'

const ESTADO_INICIAL: ResetPasswordState = {}

export function ResetPasswordForm({ token }: { token: string }) {
  const [estado, enviar, pendiente] = useActionState(resetPasswordAction, ESTADO_INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva contraseña</h1>

      <FormError id="reset-error">{estado.error}</FormError>

      {/* El token viaja en el form, no en la URL del submit: así no queda en el
          historial del browser ni en los logs de acceso del servidor. */}
      <input type="hidden" name="token" value={token} />

      <PasswordFields describedBy={estado.error ? 'reset-error' : undefined} />

      <button
        type="submit"
        disabled={pendiente}
        className="rounded bg-neutral-900 p-2 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando…' : 'Guardar contraseña'}
      </button>

      <Link href="/forgot-password" className="text-sm text-neutral-500 underline">
        Pedir un link nuevo
      </Link>
    </form>
  )
}
