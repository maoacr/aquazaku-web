'use client'

import { useActionState, useId, useState } from 'react'
import {
  agregarDireccionAction,
  cambiarEstadoAction,
  configurarCreditoAction,
  type EstadoDeFormulario,
  verificarDocumentoAction,
} from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import type { FichaDeCliente } from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

/**
 * Verificar el documento — RN-CLI-14.
 *
 * ── No es un checkbox de trámite ────────────────────────────────────────────
 *
 * Al marcarlo, quien lo hace queda registrado afirmando que tuvo el documento
 * en la mano. Si después aparece uno equivocado, se sabe quién lo dio por bueno.
 * El texto del botón lo dice, porque un «Verificar» pelado se marca sin pensar.
 *
 * El método NO se elige: lo deriva `api/` del rol de quien envía. Un selector
 * acá dejaría que un `seller` marque «ratificación oficial».
 */
export function VerificarDocumento({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(verificarDocumentoAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  if (cliente.verificacionEstado === 'verificado') return null

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <FormError id={idError}>{estado.error}</FormError>

      <p className="text-[14px] text-secundario">
        Marcarlo significa que usted tuvo el documento a la vista. Queda registrado su
        nombre y la fecha.
      </p>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Coteje el documento y verifíquelo'}
      </button>
    </form>
  )
}

/**
 * El crédito — RN-CLI-12 y RN-CLI-15.
 *
 * ── Bloqueado hasta verificar, y dice por qué ───────────────────────────────
 *
 * Con el cliente en `pendiente` el formulario no aparece: aparece la razón. Un
 * botón deshabilitado sin explicación hace que alguien lo intente tres veces y
 * después pregunte.
 *
 * Esto es cosmética, no la barrera: `api/` rechaza igual y la base tiene un
 * `CHECK` que lo hace imposible aunque alguien esquive las dos capas de arriba.
 */
export function ConfigurarCredito({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(configurarCreditoAction, INICIAL)
  const idError = useId()
  const [habilitado, setHabilitado] = useState(cliente.creditoHabilitado)

  useAvisoDeExito(estado)

  if (cliente.verificacionEstado !== 'verificado') {
    return (
      <p className="text-[14px] text-secundario">
        El crédito exige verificación. Extender crédito a una identidad sin comprobar es
        justamente el riesgo que el crédito viene a acotar, así que primero hay que cotejar
        el documento.
      </p>
    )
  }

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="habilitado" value={habilitado ? 'si' : 'no'} />
      <FormError id={idError}>{estado.error}</FormError>

      {/*
        `.aq-ficha` y no una casilla suelta: la regla de los 44 px exime a los
        checkbox porque agrandar la caja los deforma, y esa exención dejaba el
        control más chico de la app justo donde se decide quién compra a
        crédito. El objetivo táctil es la ficha entera; la casilla real queda
        en `sr-only` para el lector de pantalla.
      */}
      <label className="aq-ficha">
        <input
          type="checkbox"
          checked={habilitado}
          onChange={(e) => setHabilitado(e.target.checked)}
          className="sr-only"
        />
        <span className="aq-ficha-caja" aria-hidden />
        Puede comprar a crédito, con plazos de 30, 60 o 90 días
      </label>

      {habilitado ? (
        <label className="aq-etiqueta-campo max-w-xs">
          <span>
            Tope <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            name="limite"
            type="number"
            min="1"
            step="1"
            defaultValue={cliente.creditoLimite ?? ''}
            className="aq-campo aq-cifra"
          />
          <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
            Vacío es sin tope, y es lo normal. Poner un número hoy sería inventarlo — se
            carga cuando el negocio decida cuál.
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Guardando…' : 'Guardar el crédito'}
      </button>
    </form>
  )
}

/** Una dirección es una entidad, no un campo de texto — RN-CLI-07. */
export function AgregarDireccion({ clienteId }: { clienteId: string }) {
  const [estado, accion, enviando] = useActionState(agregarDireccionAction, INICIAL)
  const idError = useId()
  const [etiqueta, setEtiqueta] = useState('')
  const [direccion, setDireccion] = useState('')
  const [indicaciones, setIndicaciones] = useState('')

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => {
    setEtiqueta('')
    setDireccion('')
    setIndicaciones('')
  })

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <FormError id={idError}>{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Cómo la llaman</span>
          <input
            name="etiqueta"
            required
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="La casa, el negocio, la sucursal norte"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Dónde queda</span>
          <input
            name="direccion"
            required
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle 5 #3-20"
            className="aq-campo"
          />
        </label>
      </div>

      <label className="aq-etiqueta-campo">
        <span>
          Cómo llegar <span className="font-normal normal-case">(opcional)</span>
        </span>
        <input
          name="indicaciones"
          value={indicaciones}
          onChange={(e) => setIndicaciones(e.target.value)}
          placeholder="Al lado de la panadería, portón verde"
          className="aq-campo"
        />
      </label>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario justify-self-start"
      >
        {enviando ? 'Agregando…' : 'Agregar dirección'}
      </button>
    </form>
  )
}

/**
 * Baja y alta — RN-CLI-02.
 *
 * El botón dice «Desactivar», no «Eliminar», porque eso es lo que pasa: el
 * historial queda. `api/` tampoco expone `DELETE` y la base lo tiene revocado.
 */
export function CambiarEstado({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="activo" value={cliente.activo ? 'no' : 'si'} />
      <FormError id={idError}>{estado.error}</FormError>

      <p className="text-[14px] text-secundario">
        {cliente.activo
          ? 'Un cliente desactivado deja de aparecer en operaciones nuevas. Su historial, sus deudas y sus botellones quedan.'
          : 'Este cliente está desactivado y no aparece en operaciones nuevas.'}
      </p>

      <button
        type="submit"
        disabled={enviando}
        className={`aq-boton justify-self-start ${cliente.activo ? 'aq-boton-destructivo' : 'aq-boton-secundario'}`}
      >
        {enviando ? 'Guardando…' : cliente.activo ? 'Desactivar cliente' : 'Reactivar cliente'}
      </button>
    </form>
  )
}
