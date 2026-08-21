'use client'

import { useActionState } from 'react'
import { FormError } from '@/components/auth/form-error'
import { crearUsuarioAction, type EstadoDeFormulario } from '@/app/(app)/modulos/usuarios/actions'
import { LARGO_MINIMO_PASSWORD } from '@/lib/form-errors'
import { ROLES_DISPONIBLES } from '@/lib/roles'

const INICIAL: EstadoDeFormulario = {}

/**
 * Alta de usuario.
 *
 * Client Component porque necesita `useActionState`: sin él, el valor que
 * devuelve la Server Action se descarta y el admin no ve ni el error ni la
 * confirmación.
 *
 * El alta pide contraseña inicial. El usuario nuevo nace con
 * `mustChangePassword`, así que lo primero que hace al entrar es cambiarla
 * (spec §7.2): esta contraseña es de un solo uso, no una que el admin tenga que
 * custodiar.
 */
export function AltaDeUsuario() {
  const [estado, accion, enviando] = useActionState(crearUsuarioAction, INICIAL)

  return (
    <form action={accion} className="grid gap-4 rounded-lg border border-sutil p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-secundario">
        Nuevo usuario
      </h2>

      <FormError id="alta-error">{estado.error}</FormError>
      {estado.ok ? (
        <p role="status" className="text-sm text-emerald-400">
          {estado.ok}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span>Nombre</span>
          <input
            name="name"
            required
            autoComplete="off"
            className="rounded border border-fuerte bg-transparent px-2 py-1.5"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            className="rounded border border-fuerte bg-transparent px-2 py-1.5"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Contraseña inicial</span>
          <input
            name="password"
            type="password"
            required
            minLength={LARGO_MINIMO_PASSWORD}
            // `new-password` evita que el gestor de contraseñas del admin
            // ofrezca las suyas al crear una cuenta ajena.
            autoComplete="new-password"
            className="rounded border border-fuerte bg-transparent px-2 py-1.5"
          />
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm">Roles</legend>
        {/* Checkboxes y no un select: los roles se acumulan, no se eligen entre
            sí (RN-ACC-01). Un desplegable de opción única sugeriría lo
            contrario. */}
        <div className="flex flex-wrap gap-4">
          {ROLES_DISPONIBLES.map((rol) => (
            <label key={rol} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roles" value={rol} className="size-4" />
              <span>{rol}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-tenue">
          Se puede crear sin roles: entra al sistema y no ve ningún módulo.
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={enviando}
        className="justify-self-start rounded bg-accion px-4 py-2 text-sm font-medium text-invertido disabled:opacity-50"
      >
        {enviando ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  )
}
