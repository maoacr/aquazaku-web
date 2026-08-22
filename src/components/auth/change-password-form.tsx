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
      <h1 className="aq-titulo-seccion text-principal">Cambiar contraseña</h1>

      {primerIngreso && (
        <p role="status" className="text-sm text-secundario">
          Es su primer ingreso: elija una contraseña propia antes de seguir.
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
          className="aq-campo"
        />
      </label>

      <PasswordFields describedBy={estado.error ? 'change-error' : undefined} />

      {/* Avisar antes, no después: cambiarla cierra todas las sesiones. */}
      <p className="text-sm text-tenue">
        Al cambiarla se cierran todas sus sesiones y tendrá que entrar de nuevo.
      </p>

      <button
        type="submit"
        disabled={pendiente}
        className="aq-boton aq-boton-primario aq-boton-grande"
      >
        {pendiente ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
