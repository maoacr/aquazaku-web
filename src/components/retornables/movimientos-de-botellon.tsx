'use client'

import { useActionState, useId, useState } from 'react'
import {
  ajustarBotellonesAction,
  comprarBotellonesAction,
  entregarBotellonesAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/retornables/actions'
import { FormError } from '@/components/auth/form-error'
import { BuscadorDeCliente } from '@/components/clientes/buscador-de-cliente'
import type { Cliente } from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

/**
 * Entrega y retorno — RN-ENV-03 y RN-ENV-04.
 *
 * ── Un solo formulario para las dos direcciones ─────────────────────────────
 *
 * Entregar y recibir son la misma operación con el signo cambiado, y quien está
 * en el mostrador hace las dos en la misma conversación. Dos formularios
 * separados obligarían a elegir antes de saber qué trae el cliente.
 *
 * :::note
 * En una **recarga** esto no se toca: el cliente entrega un envase vacío y
 * recibe uno lleno, así que su saldo no cambia (`RN-ENV-03`). Se usa en la
 * primera entrega, y cuando devuelve envases sin llevarse otros.
 * :::
 */
export function EntregaYRetorno() {
  const [estado, accion, enviando] = useActionState(entregarBotellonesAction, INICIAL)
  const idError = useId()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [direccion, setDireccion] = useState<'entrega' | 'retorno'>('entrega')

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => {
    setCliente(null)
    setCantidad('')
  })

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <input type="hidden" name="direccion" value={direccion} />

      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Entrega y retorno</h2>
        <p className="mt-1 text-[13px] text-tenue">
          En una recarga el saldo no cambia: el cliente trae uno vacío y se lleva uno lleno.
          Esto es para la primera entrega y para cuando devuelve.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <BuscadorDeCliente elegido={cliente} onElegir={setCliente} />
        </div>

        <label className="aq-etiqueta-campo">
          <span>Cuántos</span>
          <input
            name="cantidad"
            type="number"
            required
            min="1"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="aq-campo aq-cifra"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['entrega', 'retorno'] as const).map((opcion) => (
          <label key={opcion} className="aq-ficha">
            <input
              type="radio"
              name="_direccion"
              checked={direccion === opcion}
              onChange={() => setDireccion(opcion)}
              className="sr-only"
            />
            <span className="aq-ficha-caja" aria-hidden />
            {opcion === 'entrega' ? 'Se los lleva' : 'Los devuelve'}
          </label>
        ))}
      </div>

      {/*
        El `required` del viejo `<select>` no se puede repetir en un campo
        oculto: el navegador no valida lo que no se ve. Sin este freno, el
        formulario se enviaba sin cliente y el 422 llegaba del servidor.
      */}
      <button
        type="submit"
        disabled={enviando || cliente === null}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : direccion === 'entrega' ? 'Registrar entrega' : 'Registrar retorno'}
      </button>
    </form>
  )
}

/** Entran al parque — RN-ENV-06. Solo `admin` y `pos`. */
export function ComprarBotellones() {
  const [estado, accion, enviando] = useActionState(comprarBotellonesAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Entraron botellones nuevos</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Una compra al proveedor. Es una de las dos operaciones que cambian el total del
          parque.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo">
          <span>Cuántos</span>
          <input name="cantidad" type="number" required min="1" step="1" className="aq-campo aq-cifra" />
        </label>

        <label className="aq-etiqueta-campo min-w-[16rem] flex-1">
          <span>
            De dónde <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input name="motivo" placeholder="Compra al proveedor del 27 de agosto" className="aq-campo" />
        </label>

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario">
          {enviando ? 'Registrando…' : 'Registrar'}
        </button>
      </div>
    </form>
  )
}

/**
 * El ajuste — la única fila que cambia el total sin movimiento físico.
 *
 * Por eso exige motivo: la ley de conservación después de un ajuste no dice
 * «todo cuadra», dice «alguien contó, decidió que cuadre así, y firmó».
 */
export function AjustarBotellones() {
  const [estado, accion, enviando] = useActionState(ajustarBotellonesAction, INICIAL)
  const idError = useId()
  const [dondeEsta, setDondeEsta] = useState<Cliente | null>(null)

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => setDondeEsta(null))

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Ajustar contra un conteo</h2>
        <p className="mt-1 text-[13px] text-tenue">
          La diferencia va con signo: positivo si aparecieron, negativo si faltan. Es lo
          único que hace cuadrar el parque sin que haya entrado ni salido nada.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-3">
        <BuscadorDeCliente
          etiqueta="Dónde"
          elegido={dondeEsta}
          onElegir={setDondeEsta}
          sinCliente="Sin cliente, el ajuste es en la bodega."
        />

        <label className="aq-etiqueta-campo">
          <span>Diferencia</span>
          <input name="diferencia" type="number" required step="1" className="aq-campo aq-cifra" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Motivo</span>
          <input
            name="motivo"
            required
            placeholder="Conteo del lunes: aparecieron tres detrás de la estiba"
            className="aq-campo"
          />
        </label>
      </div>

      <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario justify-self-start">
        {enviando ? 'Registrando…' : 'Registrar el ajuste'}
      </button>
    </form>
  )
}
