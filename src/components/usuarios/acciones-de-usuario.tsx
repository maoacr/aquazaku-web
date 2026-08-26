'use client'

import { useAvisoDeExito } from '@/lib/formulario-cliente'
import { useActionState } from 'react'
import {
  cambiarEstadoAction,
  cambiarRolesAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/usuarios/actions'
import { FormError } from '@/components/auth/form-error'
import type { UsuarioListado } from '@/lib/api-types'
import { ROLES_DISPONIBLES } from '@/lib/roles'

const INICIAL: EstadoDeFormulario = {}

/**
 * Repartir roles y activar o desactivar a una persona.
 *
 * ── Por qué vive en el detalle y no en la lista ──────────────────────────────
 *
 * Estaba dentro de una fila de tabla: cuatro casillas, un botón de guardar y
 * otro de desactivar, todo en una celda. Con cinco usuarios ya se leía apretado,
 * y en un teléfono había que scrollear en horizontal para llegar a los botones.
 *
 * La lista sirve para ENCONTRAR a alguien; el detalle, para actuar sobre esa
 * persona. Separarlo también hace más difícil el error caro de esta pantalla
 * —darle un rol al usuario equivocado— porque acá hay un solo nombre a la vista.
 *
 * Los dos formularios van separados y no en uno: guardar roles y desactivar una
 * cuenta son decisiones distintas, y un solo botón «guardar» las mezclaría.
 */
export function AccionesDeUsuario({ usuario }: { usuario: UsuarioListado }) {
  const [roles, guardarRoles, guardandoRoles] = useActionState(cambiarRolesAction, INICIAL)
  useAvisoDeExito(roles)
  const [estado, cambiarEstado, cambiandoEstado] = useActionState(cambiarEstadoAction, INICIAL)
  useAvisoDeExito(estado)

  const activo = usuario.status === 'active'

  return (
    <>
      <section className="aq-tarjeta grid gap-4 p-5">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">Roles</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Los roles se suman: quien tiene dos ve los módulos de los dos. No hay que elegir
            uno.
          </p>
        </div>

        <FormError id="roles-error">{roles.error}</FormError>
        <form action={guardarRoles} className="grid gap-4">
          <input type="hidden" name="userId" value={usuario.id} />

          <div className="flex flex-wrap gap-2">
            {ROLES_DISPONIBLES.map((rol) => (
              <label key={rol} className="aq-ficha">
                <input
                  type="checkbox"
                  name="roles"
                  value={rol}
                  defaultChecked={usuario.roles.includes(rol)}
                  className="sr-only"
                />
                <span className="aq-ficha-caja" aria-hidden />
                <span>{rol}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={guardandoRoles}
            className="aq-boton aq-boton-primario justify-self-start"
          >
            {guardandoRoles ? 'Guardando…' : 'Guardar roles'}
          </button>
        </form>
      </section>

      <section className="aq-tarjeta grid gap-4 p-5">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">
            {activo ? 'Desactivar la cuenta' : 'Reactivar la cuenta'}
          </h2>
          <p className="mt-1 text-[13px] text-tenue">
            {/* RN-ACC-05: un usuario no se borra, se desactiva. Borrarlo dejaría
                sus ventas huérfanas y la auditoría sin a quién señalar. */}
            {activo
              ? 'No se borra: sus ventas y su rastro en la auditoría tienen que seguir teniendo dueño. Desactivar cierra sus sesiones abiertas.'
              : 'Vuelve a poder entrar con los roles que tenga asignados.'}
          </p>
        </div>

        <FormError id="estado-error">{estado.error}</FormError>
        <form action={cambiarEstado}>
          <input type="hidden" name="userId" value={usuario.id} />
          <input type="hidden" name="status" value={activo ? 'inactive' : 'active'} />

          <button
            type="submit"
            disabled={cambiandoEstado}
            className={`aq-boton ${activo ? 'aq-boton-destructivo' : 'aq-boton-secundario'}`}
          >
            {cambiandoEstado ? '…' : activo ? 'Desactivar usuario' : 'Reactivar usuario'}
          </button>
        </form>
      </section>
    </>
  )
}
