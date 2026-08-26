'use client'

import { useAvisoDeExito } from '@/lib/formulario-cliente'
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
  useAvisoDeExito(estado)

  /*
   * El `key` remonta el formulario al crear: son campos no controlados y dejar
   * lo anterior escrito invita a crear el mismo registro dos veces. Con error
   * no hay token, así que lo escrito se conserva.
   */
  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-5 p-5">
      {/* El título del formulario es un título, no un rótulo micro en gris. */}
      <h2 className="aq-titulo-tarjeta text-principal">Nuevo usuario</h2>

      <FormError id="alta-error">{estado.error}</FormError>
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
        <legend className="aq-etiqueta-campo mb-1">Roles</legend>
        {/* Checkboxes y no un select: los roles se acumulan, no se eligen entre
            sí (RN-ACC-01). Un desplegable de opción única sugeriría lo
            contrario.

            Se dibujan como fichas: el objetivo táctil pasa a ser la ficha
            entera y no el cuadrito de 16 px. Ver `.aq-ficha` en `globals.css`. */}
        <div className="flex flex-wrap gap-2">
          {ROLES_DISPONIBLES.map((rol) => (
            <label key={rol} className="aq-ficha">
              <input type="checkbox" name="roles" value={rol} className="sr-only" />
              <span className="aq-ficha-caja" aria-hidden />
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
