'use client'

import { useActionState, useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  desactivarDireccionAction,
  editarDireccionAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import type { Departamento, DireccionConBases, Municipio } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'
import { CamposDeDireccion } from './campos-de-direccion'

const INICIAL: EstadoDeFormulario = {}

/**
 * Editar o dar de baja una dirección — M14.
 *
 * ── Se abre tocando el ícono de lápiz ───────────────────────────────────────
 *
 * El botón de edición es solo el ícono; el texto de la dirección es solo
 * lectura.
 */
export function EditarDireccion({
  clienteId,
  direccion,
  departamentos,
  municipios,
}: {
  clienteId: string
  direccion: DireccionConBases
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <div className="w-full rounded-lg px-1">
        <span className="flex items-center justify-between gap-1.5">
          <span className="text-[14px] font-medium text-principal">{direccion.etiqueta}</span>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label={`Editar dirección ${direccion.etiqueta}`}
            className="rounded p-0.5 text-tenue hover:bg-tarjeta-hover hover:text-principal"
          >
            <Pencil aria-hidden className="size-3.5 shrink-0" />
          </button>
        </span>
        <span className="block text-[14px] text-secundario">{direccion.legible}</span>
        {direccion.indicaciones ? (
          <span className="block text-[13px] text-tenue">{direccion.indicaciones}</span>
        ) : null}
      </div>

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
  direccion: DireccionConBases
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

      <DarDeBaja clienteId={clienteId} direccion={direccion} alTerminar={alGuardar} />
    </div>
  )
}

/**
 * ── Se da de BAJA, no se elimina ────────────────────────────────────────────
 *
 * La dirección queda en pie porque el historial de las bases la necesita: sin
 * ella, los préstamos viejos no se pueden traducir a un lugar y nadie sabría en
 * cuál de los tres locales estuvo la base 0913 en marzo.
 *
 * El botón dice lo que pasa. Decir «Eliminar» y desactivar sería mentir sobre
 * el propio sistema.
 *
 * ── Pero la base que está ahí HOY vuelve al parque ──────────────────────────
 *
 * Y el texto lo tiene que decir. Antes decía «las bases prestadas ahí siguen
 * siendo reclamables», que era cierto mientras la baja solo marcaba la
 * dirección inactiva —la base quedaba colgada de una puerta que ya no existe,
 * ni reclamable a nadie ni disponible para prestar—. Dejarlo así ahora sería
 * describir el defecto que se arregló.
 *
 * ── La confirmación pregunta, no advierte ───────────────────────────────────
 *
 * Un «¿está seguro?» se contesta que sí sin leer. Decir qué va a pasar —y
 * CUÁNTAS bases se mueven— le da a la persona algo con qué decidir.
 */
function DarDeBaja({
  clienteId,
  direccion,
  alTerminar,
}: {
  clienteId: string
  direccion: DireccionConBases
  alTerminar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [estado, accion, enviando] = useActionState(desactivarDireccionAction, INICIAL)
  const idError = useId()
  const idMotivo = useId()

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

  /*
   * El conteo viaja con la ficha y lo calcula `basesPrestadasEn` — la MISMA
   * consulta que la baja usa para devolverlas. Eso es lo que hace que esta
   * pantalla no pueda mentir: lo que se lee y lo que se ejecuta salen de la
   * misma cuenta.
   */
  const bases = direccion.basesPrestadas
  const plural = bases === 1 ? '' : 's'

  /*
   * El mismo piso que `api/`. Se exige acá para poder decir qué falta ANTES del
   * viaje, en vez de devolver un 400 que nadie iba a leer.
   */
  const faltaMotivo = motivo.trim().length < 10

  return (
    <form action={accion} className="grid gap-3 border-t border-sutil pt-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="id" value={direccion.id} />

      <p className="text-[14px] text-principal">
        Deja de aparecer para despachar y prestar bases. El historial de lo que se entregó ahí
        se conserva: la dirección no se borra.
      </p>

      {bases > 0 ? (
        <p className="rounded-lg border border-sutil p-3 text-[14px] text-secundario">
          <strong className="text-principal">
            {bases} base{plural}
          </strong>{' '}
          prestada{plural} en esta dirección vuelve{plural === '' ? '' : 'n'} al parque y
          queda{plural === '' ? '' : 'n'} disponible{plural} para prestar. Si el cliente se la
          queda en otra de sus direcciones, préstesela de nuevo desde allá.
        </p>
      ) : (
        <p className="text-[13px] text-tenue">
          No hay bases prestadas en esta dirección, así que no se mueve nada del parque.
        </p>
      )}

      <FormError id={idError}>{estado.error}</FormError>

      <label className="aq-etiqueta-campo" htmlFor={idMotivo}>
        <span>
          Por qué se da de baja <span className="text-alerta">·</span>{' '}
          <span className="font-normal normal-case text-tenue">obligatorio</span>
        </span>
        <textarea
          id={idMotivo}
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="El cliente devolvió el equipo de ese local"
          aria-describedby={idError}
          className="aq-campo"
        />
        <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
          {faltaMotivo
            ? 'Escriba al menos 10 caracteres: es lo que explica esta baja dentro de tres meses.'
            : 'Queda en la bitácora con su nombre y la hora.'}
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando || faltaMotivo}
          className="aq-boton aq-boton-primario"
        >
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
