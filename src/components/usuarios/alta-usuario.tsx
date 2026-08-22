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
    <form action={accion} className="aq-tarjeta grid gap-5 p-5">
      {/* El título del formulario es un título, no un rótulo micro en gris. */}
      <h2 className="aq-titulo-tarjeta text-principal">Nuevo usuario</h2>

      <FormError id="alta-error">{estado.error}</FormError>
      {estado.ok ? (
        <p role="status" className="text-[14px] text-exito-texto">
          {estado.ok}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="aq-etiqueta-campo">
          <span>Nombre</span>
          <input name="name" required autoComplete="off" className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="off" className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Contraseña inicial</span>
          <input
            name="password"
            type="password"
            required
            minLength={LARGO_MINIMO_PASSWORD}
            // `new-password` evita que el gestor de contraseñas del admin
            // ofrezca las suyas al crear una cuenta ajena.
            autoComplete="new-password"
            className="aq-campo"
          />
        </label>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="aq-etiqueta-campo">Roles</legend>
        {/* Checkboxes y no un select: los roles se acumulan, no se eligen entre
            sí (RN-ACC-01). Un desplegable de opción única sugeriría lo
            contrario. */}
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {ROLES_DISPONIBLES.map((rol) => (
            <label
              key={rol}
              className="flex items-center gap-2 text-[14px] text-principal"
            >
              <input type="checkbox" name="roles" value={rol} className="size-4 accent-accion" />
              <span>{rol}</span>
            </label>
          ))}
        </div>
        <p className="text-[13px] text-tenue">
          Se puede crear sin roles: entra al sistema y no ve ningún módulo.
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  )
}
