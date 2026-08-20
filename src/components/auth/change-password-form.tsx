'use client'

import { useActionState } from 'react'
import {
  type ChangePasswordState,
  changePasswordAction,
} from '@/app/(auth)/change-password/actions'
import { FormError } from './form-error'
import { PasswordFields } from './password-fields'

const ESTADO_INICIAL: ChangePasswordState = {}

export function ChangePasswordForm({ primerIngreso = false }: { primerIngreso?: boolean }) {
  const [estado, enviar, pendiente] = useActionState(changePasswordAction, ESTADO_INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Cambiar contraseña</h1>

      {primerIngreso && (
        <p role="status" className="text-sm text-neutral-600">
          Es tu primer ingreso: elegí una contraseña propia antes de seguir.
        </p>
      )}

      <FormError id="change-error">{estado.error}</FormError>

      <label className="flex flex-col gap-1 text-sm">
        Contraseña actual
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          aria-describedby={estado.error ? 'change-error' : undefined}
          className="rounded border border-neutral-300 p-2"
        />
      </label>

      <PasswordFields describedBy={estado.error ? 'change-error' : undefined} />

      {/* Avisar antes, no después: cambiarla cierra todas las sesiones. */}
      <p className="text-xs text-neutral-500">
        Al cambiarla se cierran todas tus sesiones y vas a tener que entrar de nuevo.
      </p>

      <button
        type="submit"
        disabled={pendiente}
        className="rounded bg-neutral-900 p-2 text-sm text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
