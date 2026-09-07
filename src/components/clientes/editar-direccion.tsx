'use client'

import { useActionState, useId, useState } from 'react'
import {
  desactivarDireccionAction,
  editarDireccionAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import type { Departamento, Direccion, Municipio } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'
import { CamposDeDireccion } from './campos-de-direccion'

const INICIAL: EstadoDeFormulario = {}

/**
 * Editar o dar de baja una dirección — M14.
 *
 * ── Se abre tocando la dirección, no un ícono ───────────────────────────────
 *
 * El objetivo del toque es la dirección entera. Un lápiz de dieciséis píxeles
 * al costado se falla con el pulgar, y esto se usa desde un celular al lado de
 * una llenadora.
 */
export function EditarDireccion({
  clienteId,
  direccion,
  departamentos,
  municipios,
}: {
  clienteId: string
  direccion: Direccion
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-lg px-1 text-left hover:bg-tarjeta-hover"
      >
        <span className="text-[14px] font-medium text-principal">{direccion.etiqueta}</span>
        <span className="block text-[14px] text-secundario">{direccion.legible}</span>
        {direccion.indicaciones ? (
          <span className="block text-[13px] text-tenue">{direccion.indicaciones}</span>
        ) : null}
      </button>

      <Modal abierto={abierto} cerrar={() => setAbierto(false)} titulo={direccion.etiqueta}>
        <FormularioDeEdicion
          clienteId={clienteId}
          direccion={direccion}
          departamentos={departamentos}
          municipios={municipios}
          alGuardar={() => setAbierto(false)}
        />
      </Modal>
    </>
  )
}

function FormularioDeEdicion({
  clienteId,
  direccion,
  departamentos,
  municipios,
  alGuardar,
}: {
  clienteId: string
  direccion: Direccion
  departamentos: Departamento[]
  municipios: Municipio[]
  alGuardar: () => void
}) {
  const [estado, accion, enviando] = useActionState(editarDireccionAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  /*
   * Cerrar al guardar y NO al fallar. Un modal que se cierra ante un error se
   * lleva puesto lo que la persona escribió, y la deja adivinando qué pasó.
   */
  if (estado.token) alGuardar()

  return (
    <div className="grid gap-5">
      <form action={accion} className="grid gap-5">
        <input type="hidden" name="clienteId" value={clienteId} />
        <input type="hidden" name="id" value={direccion.id} />
        <FormError id={idError}>{estado.error}</FormError>

        <CamposDeDireccion
          inicial={direccion}
          departamentos={departamentos}
          municipios={municipios}
        />

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-primario">
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <DarDeBaja clienteId={clienteId} id={direccion.id} alTerminar={alGuardar} />
    </div>
  )
}

/**
 * ── Se da de BAJA, no se elimina ────────────────────────────────────────────
 *
 * Una dirección puede tener bases prestadas. Si desapareciera, el préstamo
 * dejaría de ser reclamable: nadie sabría a cuál de los tres locales ir a
 * buscar la base 0913.
 *
 * El botón dice lo que pasa. Decir «Eliminar» y desactivar sería mentir sobre
 * el propio sistema.
 *
 * ── La confirmación pregunta, no advierte ───────────────────────────────────
 *
 * Un «¿está seguro?» se contesta que sí sin leer. Decir qué va a pasar —«deja
 * de aparecer, el historial se conserva»— le da a la persona algo con qué
 * decidir.
 */
function DarDeBaja({
  clienteId,
  id,
  alTerminar,
}: {
  clienteId: string
  id: string
  alTerminar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, enviando] = useActionState(desactivarDireccionAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)
  if (estado.token) alTerminar()

  if (!confirmando) {
    return (
      <div className="border-t border-sutil pt-4">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="aq-boton aq-boton-secundario text-alerta"
        >
          Dar de baja esta dirección
        </button>
      </div>
    )
  }

  return (
    <form action={accion} className="grid gap-3 border-t border-sutil pt-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="id" value={id} />

      <p className="text-[14px] text-secundario">
        Deja de aparecer para despachar y prestar bases. Lo que ya se le entregó se conserva: la
        dirección no se borra, y las bases prestadas ahí siguen siendo reclamables.
      </p>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className="aq-boton aq-boton-primario">
          {enviando ? 'Dando de baja…' : 'Sí, darla de baja'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="aq-boton aq-boton-secundario"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
