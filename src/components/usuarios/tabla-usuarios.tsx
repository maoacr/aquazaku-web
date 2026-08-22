'use client'

import { useActionState } from 'react'
import {
  cambiarEstadoAction,
  cambiarRolesAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/usuarios/actions'
import { Encabezados, Etiqueta, SinResultados, Tabla, Td, Th } from '@/components/ui/tabla'
import type { UsuarioListado } from '@/lib/api-types'
import { ROLES_DISPONIBLES } from '@/lib/roles'

const INICIAL: EstadoDeFormulario = {}

export function TablaDeUsuarios({ usuarios }: { usuarios: UsuarioListado[] }) {
  return (
    <Tabla>
      <Encabezados>
        <Th>Nombre</Th>
        <Th>Email</Th>
        <Th>Estado</Th>
        <Th>Roles</Th>
        <Th>Acciones</Th>
      </Encabezados>
      <tbody>
        {usuarios.length === 0 ? (
          <SinResultados columnas={5}>Todavía no hay usuarios.</SinResultados>
        ) : (
          usuarios.map((usuario) => <Fila key={usuario.id} usuario={usuario} />)
        )}
      </tbody>
    </Tabla>
  )
}

function Fila({ usuario }: { usuario: UsuarioListado }) {
  const [roles, guardarRoles, guardandoRoles] = useActionState(cambiarRolesAction, INICIAL)
  const [estado, cambiarEstado, cambiandoEstado] = useActionState(cambiarEstadoAction, INICIAL)

  const activo = usuario.status === 'active'
  const mensaje = roles.error ?? estado.error ?? roles.ok ?? estado.ok
  const esError = Boolean(roles.error ?? estado.error)

  return (
    <>
      <tr>
        <Td>
          <span className="font-medium">{usuario.name}</span>
          {usuario.mustChangePassword ? (
            <p className="mt-0.5 text-sm text-tenue">Pendiente de cambiar contraseña</p>
          ) : null}
        </Td>
        <Td>{usuario.email}</Td>
        <Td>
          <Etiqueta tono={activo ? 'ok' : 'alerta'}>{activo ? 'Activo' : 'Inactivo'}</Etiqueta>
        </Td>

        <Td>
          {/* El formulario manda el conjunto COMPLETO de roles, no un diff: el
              endpoint es idempotente y reemplaza. Cada checkbox marcado viaja
              como un valor de `roles`. */}
          <form action={guardarRoles} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="userId" value={usuario.id} />
            {ROLES_DISPONIBLES.map((rol) => (
              <label key={rol} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="roles"
                  value={rol}
                  defaultChecked={usuario.roles.includes(rol)}
                  className="size-3.5"
                />
                <span>{rol}</span>
              </label>
            ))}
            <button
              type="submit"
              disabled={guardandoRoles}
              className="aq-boton aq-boton-secundario aq-boton-compacto"
            >
              {guardandoRoles ? 'Guardando…' : 'Guardar roles'}
            </button>
          </form>
        </Td>

        <Td>
          <form action={cambiarEstado}>
            <input type="hidden" name="userId" value={usuario.id} />
            <input type="hidden" name="status" value={activo ? 'inactive' : 'active'} />
            <button
              type="submit"
              disabled={cambiandoEstado}
              className="aq-boton aq-boton-secundario aq-boton-compacto"
            >
              {cambiandoEstado ? '…' : activo ? 'Desactivar' : 'Reactivar'}
            </button>
          </form>
          {/* RN-ACC-05: un usuario no se borra, se desactiva. Por eso no hay
              botón de borrar: sus ventas quedarían huérfanas. */}
        </Td>
      </tr>

      {mensaje ? (
        <tr>
          <Td className="!pt-0">
            <span />
          </Td>
          <td colSpan={4} className="px-3 pb-2">
            <p
              role={esError ? 'alert' : 'status'}
              className={`text-sm ${esError ? 'text-error-texto' : 'text-exito-texto'}`}
            >
              {mensaje}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  )
}
