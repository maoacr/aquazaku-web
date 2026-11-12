'use client'

import { useActionState, useId, useState } from 'react'
import {
  type EstadoDeFormulario,
  registrarGastoAction,
} from '@/app/(app)/modulos/gastos/actions'
import { FormError } from '@/components/auth/form-error'
import type { CuentaConSaldo, Proveedor, TipoDeEgreso } from '@/lib/api-types'
import { useAvisoDeExito, useSelectResistenteAlReset } from '@/lib/formulario-cliente'
import { AYUDA_DE_EGRESO, ETIQUETA_DE_EGRESO, TIPOS_DE_EGRESO } from '@/lib/gastos'
import { aCentavos, pesos } from '@/lib/plata'

const INICIAL: EstadoDeFormulario = {}

/**
 * Registrar un gasto — M17.
 *
 * ── Va primero en la pantalla ───────────────────────────────────────────────
 *
 * Es lo que pasa todos los días. Cargar una cuenta bancaria pasa una vez cada
 * tanto, y va al final por eso — el mismo orden que en Proveedores y en
 * Retornables.
 *
 * ── Los dos `<select>` son controlados y van por el hook ────────────────────
 *
 * Todo `<form action>` llama a `form.reset()` en la fase de commit, con éxito y
 * con error. A un `<input>` controlado React lo restaura; a un `<select>` lo
 * deja en blanco. Sin el hook, quien corrige un monto rechazado reintenta con la
 * cuenta en blanco — y un gasto cargado en la caja equivocada solo se arregla
 * anulando, porque un movimiento no se edita (RN-GAS-05).
 */
export function RegistrarGasto({
  cuentas,
  proveedores,
  hoy,
}: {
  cuentas: CuentaConSaldo[]
  proveedores: Proveedor[]
  /** La fecha de la PLANTA, calculada en el servidor. Ver el comentario abajo. */
  hoy: string
}) {
  const [estado, accion, enviando] = useActionState(registrarGastoAction, INICIAL)
  const idError = useId()

  const conSaldo = cuentas.filter((c) => c.activa && aCentavos(c.saldo) > 0)

  const [cuentaId, setCuentaId] = useState('')
  const [tipoDeEgreso, setTipoDeEgreso] = useState<TipoDeEgreso | ''>('')
  const refCuenta = useSelectResistenteAlReset(cuentaId)
  const refTipo = useSelectResistenteAlReset(tipoDeEgreso)

  useAvisoDeExito(estado)

  const cuenta = conSaldo.find((c) => c.id === cuentaId)

  /*
   * ── Si no hay de dónde sacar plata, el formulario no sirve ────────────────
   *
   * Y se dice por qué, en vez de mostrar un botón apagado. Un control
   * deshabilitado sin explicación obliga a adivinar qué falta: acá falta cargar
   * el saldo inicial, que es una acción concreta y está más abajo.
   */
  if (conSaldo.length === 0) {
    return (
      <section className="aq-tarjeta grid gap-2 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">Registrar un gasto</h2>
        <p className="text-[14px] text-secundario">
          Todavía no hay ninguna cuenta con saldo, así que no hay de dónde salga la plata. Cargue
          el saldo inicial de la caja —abajo, en «La plata que ya había»— y vuelva acá.
        </p>
      </section>
    )
  }

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Registrar un gasto</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Lo que se paga y no es mercadería. Los insumos, botellones y bases van por Proveedores:
          esos mueven inventario.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        {/* El ancho va en el CONTENEDOR: `.aq-campo` le gana a los `w-*`. */}
        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
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
            {conSaldo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {pesos(c.saldo)}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
          <span>Qué se pagó</span>
          <select
            ref={refTipo}
            name="tipoDeEgreso"
            required
            value={tipoDeEgreso}
            onChange={(e) => setTipoDeEgreso(e.target.value as TipoDeEgreso)}
            className="aq-campo"
          >
            <option value="">Elija un tipo…</option>
            {TIPOS_DE_EGRESO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_DE_EGRESO[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/*
        La ayuda del tipo elegido. Catorce tipos no se distinguen por el nombre
        solo: «servicio» y «mantenimiento» se confunden, y un gasto mal
        clasificado no se descubre después.
      */}
      {tipoDeEgreso ? (
        <p className="-mt-2 text-[13px] text-tenue">{AYUDA_DE_EGRESO[tipoDeEgreso]}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo w-40">
          <span>Cuánto</span>
          <input
            key={`monto-${estado.token ?? 'inicial'}`}
            name="monto"
            required
            inputMode="decimal"
            placeholder="80000"
            className="aq-campo aq-cifra"
          />
        </label>

        <label className="aq-etiqueta-campo w-44">
          <span>Cuándo se pagó</span>
          {/*
            `max={hoy}` con la fecha de la PLANTA, no del browser. El
            calendario del sistema operativo usa la zona del dispositivo: un
            teléfono en otra zona ofrecería mañana, y `api/` lo rechazaría con
            un 422 que nadie entiende (RN-GAS-08).
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

        <label className="aq-etiqueta-campo min-w-[16rem] flex-1">
          <span>Concepto</span>
          <input
            key={`concepto-${estado.token ?? 'inicial'}`}
            name="concepto"
            required
            minLength={3}
            placeholder="Recibo de la luz de octubre"
            className="aq-campo"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
          <span>
            A quién <span className="font-normal normal-case">(opcional)</span>
          </span>
          {/*
            Un proveedor registrado o un nombre escrito a mano, y no los dos:
            exigir que «EPM» sea un proveedor del sistema para pagar la luz
            llenaría el catálogo de proveedores de cosas que no se le compran.
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

        <label className="aq-etiqueta-campo min-w-[11rem] flex-1">
          <span>
            O a nombre de <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            key={`beneficiario-${estado.token ?? 'inicial'}`}
            name="beneficiario"
            placeholder="El electricista"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo w-40">
          <span>
            Factura <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            key={`factura-${estado.token ?? 'inicial'}`}
            name="numeroDeFactura"
            placeholder="FV-1024"
            className="aq-campo aq-cifra"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="aq-boton aq-boton-primario justify-self-start"
        >
          {enviando ? 'Registrando…' : 'Registrar el gasto'}
        </button>

        {cuenta ? (
          <p className="text-[13px] text-tenue">
            {cuenta.nombre} tiene <span className="aq-cifra">{pesos(cuenta.saldo)}</span>. Un gasto
            no puede dejarla en negativo.
          </p>
        ) : null}
      </div>
    </form>
  )
}
