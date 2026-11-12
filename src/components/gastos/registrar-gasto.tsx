'use client'

import { Plus } from 'lucide-react'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import {
  type EstadoDeFormulario,
  registrarGastoAction,
} from '@/app/(app)/modulos/gastos/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import type { CuentaConSaldo, Proveedor, TipoDeEgreso } from '@/lib/api-types'
import { useAvisoDeExito, useSelectResistenteAlReset } from '@/lib/formulario-cliente'
import { AYUDA_DE_EGRESO, ETIQUETA_DE_EGRESO, GRUPOS_DE_EGRESO } from '@/lib/gastos'
import { aCentavos, pesos } from '@/lib/plata'

const INICIAL: EstadoDeFormulario = {}

/**
 * Registrar un pago — M17.
 *
 * ── Un botón y un modal, no un formulario siempre abierto ───────────────────
 *
 * El formulario tiene nueve campos y ocupaba media pantalla todo el tiempo,
 * empujando los saldos y el libro hacia abajo. Pero la pantalla se abre muchas
 * más veces para MIRAR —cuánto hay, qué se pagó— que para cargar.
 *
 * El modal le da al registro un comienzo y un final claros, y deja la pantalla
 * contestando la pregunta con la que se entra. El botón queda arriba, al lado
 * de los saldos, que es donde se lo busca.
 *
 * Y el modal monta su contenido solo cuando está abierto: un formulario que vive
 * escondido conserva lo que alguien escribió y descartó, y reaparece con eso.
 */
export function RegistrarGasto({
  cuentas,
  proveedores,
  hoy,
}: {
  cuentas: CuentaConSaldo[]
  proveedores: Proveedor[]
  /** La fecha de la PLANTA, calculada en el servidor. */
  hoy: string
}) {
  const [abierto, setAbierto] = useState(false)
  const conSaldo = cuentas.filter((c) => c.activa && aCentavos(c.saldo) > 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={conSaldo.length === 0}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        <Plus aria-hidden className="size-4" />
        Registrar pago
      </button>

      {/*
        ── Si el botón está apagado, se dice por qué ─────────────────────────

        Un control deshabilitado sin explicación obliga a adivinar qué falta.
        Acá falta cargar el saldo inicial: sin una cuenta con plata no hay de
        dónde salga el pago, y eso es una acción concreta que está más abajo.
      */}
      {conSaldo.length === 0 ? (
        <p className="text-[13px] text-tenue">
          Ninguna cuenta tiene saldo todavía, así que no hay de dónde salga la plata. Cargue el
          saldo inicial de la caja —abajo, en «La plata que ya había»— y el botón se habilita.
        </p>
      ) : null}

      <Modal abierto={abierto} cerrar={() => setAbierto(false)} titulo="Registrar un pago">
        <Formulario
          cuentas={conSaldo}
          proveedores={proveedores}
          hoy={hoy}
          cerrar={() => setAbierto(false)}
        />
      </Modal>
    </>
  )
}

function Formulario({
  cuentas,
  proveedores,
  hoy,
  cerrar,
}: {
  cuentas: CuentaConSaldo[]
  proveedores: Proveedor[]
  hoy: string
  cerrar: () => void
}) {
  const [estado, accion, enviando] = useActionState(registrarGastoAction, INICIAL)
  const idError = useId()

  /*
   * Los dos `<select>` son controlados y van por el hook: todo `<form action>`
   * llama a `form.reset()` en el commit, con éxito y con error. A un `<input>`
   * controlado React lo restaura; a un `<select>` lo deja en blanco. Sin esto,
   * quien corrige un monto rechazado reintenta con la cuenta vacía — y un pago
   * cargado en la caja equivocada solo se arregla anulando (RN-GAS-05).
   */
  const [cuentaId, setCuentaId] = useState(cuentas.length === 1 ? cuentas[0]!.id : '')
  const [tipoDeEgreso, setTipoDeEgreso] = useState<TipoDeEgreso | ''>('')
  const refCuenta = useSelectResistenteAlReset(cuentaId)
  const refTipo = useSelectResistenteAlReset(tipoDeEgreso)

  useAvisoDeExito(estado)

  /*
   * ── El modal se cierra SOLO cuando el pago quedó registrado ─────────────
   *
   * Va en un `useEffect` y NO en `useLimpiezaAlRegistrar`, aunque ese hook
   * parezca el indicado: ese ajusta estado del PROPIO componente durante el
   * render, y `cerrar` es un `setState` del PADRE. React lo prohíbe —
   * «Cannot update a component while rendering a different component»— y lo
   * destapó la suite completa, no el test aislado: con el componente solo, el
   * aviso sale por consola y el render igual termina.
   *
   * Cerrar un modal ajeno es un efecto externo, igual que disparar el toast.
   * El `ref` lo ancla al token para que no se repita, y con error no hay token:
   * se queda abierto y conserva lo escrito, que es cuando más duele perderlo.
   */
  const ultimoCerrado = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!estado.token || estado.token === ultimoCerrado.current) return

    ultimoCerrado.current = estado.token
    cerrar()
  }, [estado.token, cerrar])

  const cuenta = cuentas.find((c) => c.id === cuentaId)

  return (
    <form action={accion} className="grid gap-4">
      <p className="text-[13px] text-tenue">
        Lo que se paga y no es mercadería. Los insumos, botellones y bases van por Proveedores:
        esos mueven inventario.
      </p>

      <FormError id={idError}>{estado.error}</FormError>

      <label className="aq-etiqueta-campo">
        <span>Qué se pagó</span>
        {/*
          Agrupado por categoría: catorce opciones planas se recorren leyéndolas
          todas. Los grupos son de pantalla —no viajan ni se guardan— así que un
          grupo mal elegido se corrige editando una lista.
        */}
        <select
          ref={refTipo}
          name="tipoDeEgreso"
          required
          value={tipoDeEgreso}
          onChange={(e) => setTipoDeEgreso(e.target.value as TipoDeEgreso)}
          className="aq-campo"
        >
          <option value="">Elija una categoría…</option>
          {GRUPOS_DE_EGRESO.map((grupo) => (
            <optgroup key={grupo.titulo} label={grupo.titulo}>
              {grupo.tipos.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_DE_EGRESO[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {tipoDeEgreso ? (
          <span className="text-[12px] font-normal normal-case text-tenue">
            {AYUDA_DE_EGRESO[tipoDeEgreso]}
          </span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo w-40">
          <span>Cuánto</span>
          <input
            name="monto"
            required
            inputMode="decimal"
            placeholder="80000"
            className="aq-campo aq-cifra"
          />
        </label>

        <label className="aq-etiqueta-campo min-w-[11rem] flex-1">
          <span>Cuándo se pagó</span>
          {/*
            Viene en hoy y se puede cambiar: un recibo se paga el martes y se
            carga el viernes. El `max` usa la fecha de la PLANTA resuelta en el
            servidor — el calendario del sistema operativo usa la zona del
            dispositivo, y en otra zona ofrecería mañana (RN-GAS-08).
          */}
          <input
            type="date"
            name="ocurridoEl"
            required
            defaultValue={hoy}
            max={hoy}
            className="aq-campo aq-cifra"
          />
        </label>
      </div>

      <label className="aq-etiqueta-campo">
        <span>De qué cuenta sale</span>
        <select
          ref={refCuenta}
          name="cuentaId"
          required
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          className="aq-campo"
        >
          <option value="">Elija una cuenta…</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} — {pesos(c.saldo)}
            </option>
          ))}
        </select>
        {cuenta ? (
          <span className="text-[12px] font-normal normal-case text-tenue">
            Queda {pesos(cuenta.saldo)}. Un pago no puede dejar la cuenta en negativo.
          </span>
        ) : null}
      </label>

      <label className="aq-etiqueta-campo">
        <span>Concepto</span>
        <input
          name="concepto"
          required
          minLength={3}
          placeholder="Recibo de la luz de octubre"
          className="aq-campo"
        />
      </label>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[12rem] flex-1">
          <span>
            A quién <span className="font-normal normal-case">(opcional)</span>
          </span>
          {/*
            Un proveedor registrado o un nombre escrito a mano. Exigir que «EPM»
            sea proveedor del sistema para pagar la luz llenaría el catálogo de
            proveedores con cosas a las que no se les compra nada.
          */}
          <select name="proveedorId" className="aq-campo" defaultValue="">
            <option value="">Nadie en particular / escribo el nombre</option>
            {proveedores
              .filter((p) => p.activo)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo min-w-[10rem] flex-1">
          <span>
            O a nombre de <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input name="beneficiario" placeholder="El electricista" className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo w-36">
          <span>
            Factura <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input name="numeroDeFactura" placeholder="FV-1024" className="aq-campo aq-cifra" />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={enviando} className="aq-boton aq-boton-primario">
          {enviando ? 'Registrando…' : 'Registrar el pago'}
        </button>
        <button type="button" onClick={cerrar} className="aq-boton aq-boton-secundario">
          Cancelar
        </button>
      </div>
    </form>
  )
}
