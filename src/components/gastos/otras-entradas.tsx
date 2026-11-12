'use client'

import { useActionState, useId, useState } from 'react'
import {
  cambiarEstadoDeCuentaAction,
  crearCuentaBancariaAction,
  type EstadoDeFormulario,
  registrarIngresoAction,
  registrarSaldoInicialAction,
} from '@/app/(app)/modulos/gastos/actions'
import { FormError } from '@/components/auth/form-error'
import { Estado } from '@/components/ui/estado'
import type { CuentaConSaldo, TipoDeIngreso } from '@/lib/api-types'
import { useAvisoDeExito, useSelectResistenteAlReset } from '@/lib/formulario-cliente'
import { ETIQUETA_DE_INGRESO, TIPOS_DE_INGRESO } from '@/lib/gastos'
import { aCentavos, pesos } from '@/lib/plata'

const INICIAL: EstadoDeFormulario = {}

/**
 * Lo que se hace de vez en cuando — M16.
 *
 * Registrar un ingreso, cargar el saldo inicial de una cuenta y dar de alta una
 * cuenta bancaria. Va al final de la pantalla por frecuencia: el gasto pasa
 * todos los días, esto no.
 */

/**
 * Plata que entra y no es una venta registrada en el mostrador.
 *
 * El recaudo de ventas SÍ se registra acá, y no toca M6: la venta ya quedó
 * escrita cuando ocurrió. En qué cuenta aterrizó el efectivo es un hecho
 * distinto y posterior — en la vida real el vendedor entrega la plata del día y
 * recién ahí está en la caja (RN-GAS-10).
 */
export function RegistrarIngreso({
  cuentas,
  hoy,
}: {
  cuentas: CuentaConSaldo[]
  hoy: string
}) {
  const [estado, accion, enviando] = useActionState(registrarIngresoAction, INICIAL)
  const idError = useId()

  const [cuentaId, setCuentaId] = useState('')
  const [tipoDeIngreso, setTipoDeIngreso] = useState<TipoDeIngreso | ''>('')
  const refCuenta = useSelectResistenteAlReset(cuentaId)
  const refTipo = useSelectResistenteAlReset(tipoDeIngreso)

  useAvisoDeExito(estado)

  const activas = cuentas.filter((c) => c.activa)

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Registrar un ingreso</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Plata que entra: el efectivo de las ventas cuando se mete a la caja, un aporte, un
          préstamo. La venta ya quedó registrada en el mostrador; esto dice en qué cuenta
          aterrizó.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
          <span>A qué cuenta entra</span>
          <select
            ref={refCuenta}
            name="cuentaId"
            required
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="aq-campo"
          >
            <option value="">Elija una cuenta…</option>
            {activas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
          <span>De dónde viene</span>
          <select
            ref={refTipo}
            name="tipoDeIngreso"
            required
            value={tipoDeIngreso}
            onChange={(e) => setTipoDeIngreso(e.target.value as TipoDeIngreso)}
            className="aq-campo"
          >
            <option value="">Elija…</option>
            {TIPOS_DE_INGRESO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_DE_INGRESO[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo w-40">
          <span>Cuánto</span>
          <input
            key={`ingreso-monto-${estado.token ?? 'inicial'}`}
            name="monto"
            required
            inputMode="decimal"
            placeholder="250000"
            className="aq-campo aq-cifra"
          />
        </label>

        <label className="aq-etiqueta-campo w-44">
          <span>Cuándo entró</span>
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
            key={`ingreso-concepto-${estado.token ?? 'inicial'}`}
            name="concepto"
            required
            minLength={3}
            placeholder="Efectivo de las ventas del lunes"
            className="aq-campo"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar el ingreso'}
      </button>
    </form>
  )
}

/**
 * El saldo inicial — la plata que ya había cuando la cuenta entró al sistema.
 *
 * ── Solo ofrece las cuentas que todavía no lo tienen ────────────────────────
 *
 * Una sola vez por cuenta (RN-GAS-04): cargarlo dos veces es la misma plata
 * contada dos veces, y es el peor tipo de error porque las dos filas son
 * legítimas por separado. `api/` lo rechaza igual —el índice está en la base—
 * pero ofrecer una cuenta que no lo acepta es ofrecer un camino al error.
 *
 * Se decide por `tieneSaldoInicial`, que lo calcula el servidor leyendo el
 * libro. No se deduce de «el saldo es cero»: una cuenta puede tener su saldo
 * inicial cargado y haber quedado en cero después de gastar todo.
 */
export function CargarSaldoInicial({
  cuentas,
  sinSaldoInicial,
  hoy,
}: {
  cuentas: CuentaConSaldo[]
  /** Ids de las cuentas que todavía no tienen saldo inicial vigente. */
  sinSaldoInicial: string[]
  hoy: string
}) {
  const [estado, accion, enviando] = useActionState(registrarSaldoInicialAction, INICIAL)
  const idError = useId()

  const [cuentaId, setCuentaId] = useState('')
  const refCuenta = useSelectResistenteAlReset(cuentaId)

  useAvisoDeExito(estado)

  const elegibles = cuentas.filter((c) => c.activa && sinSaldoInicial.includes(c.id))

  if (elegibles.length === 0) {
    return (
      <section className="aq-tarjeta grid gap-2 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">La plata que ya había</h2>
        <p className="text-[14px] text-secundario">
          Todas las cuentas tienen su saldo inicial cargado. Se carga una sola vez por cuenta: de
          nuevo contaría la misma plata dos veces. Si alguno quedó mal, anulalo en el libro y
          vuelva a cargarlo.
        </p>
      </section>
    )
  }

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">La plata que ya había</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Cuente lo que hay en la cuenta hoy y cárguelo. Es el punto de partida del libro, y se
          carga una sola vez por cuenta.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
          <span>Qué cuenta</span>
          <select
            ref={refCuenta}
            name="cuentaId"
            required
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="aq-campo"
          >
            <option value="">Elija una cuenta…</option>
            {elegibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo w-40">
          <span>Cuánto hay</span>
          <input
            key={`inicial-monto-${estado.token ?? 'inicial'}`}
            name="monto"
            required
            inputMode="decimal"
            placeholder="500000"
            className="aq-campo aq-cifra"
          />
        </label>

        <label className="aq-etiqueta-campo w-44">
          <span>Contado el día</span>
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
            key={`inicial-concepto-${estado.token ?? 'inicial'}`}
            name="concepto"
            required
            minLength={3}
            defaultValue="Lo que había en la cuenta al empezar"
            className="aq-campo"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario justify-self-start"
      >
        {enviando ? 'Cargando…' : 'Cargar el saldo inicial'}
      </button>
    </form>
  )
}

/** Dar de alta una cuenta bancaria. Las dos cajas ya existen y son únicas. */
export function CrearCuentaBancaria() {
  const [estado, accion, enviando] = useActionState(crearCuentaBancariaAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form
      key={estado.token ?? 'inicial'}
      action={accion}
      className="aq-tarjeta grid gap-4 p-5"
    >
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Cargar una cuenta bancaria</h2>
        <p className="mt-1 text-[13px] text-tenue">
          La caja menor y la caja mayor ya existen y no se crean. El número es con lo que se
          coteja contra el extracto que manda el banco.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[13rem] flex-1">
          <span>Cómo la llamamos</span>
          <input
            name="nombre"
            required
            placeholder="Bancolombia ahorros"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo min-w-[11rem] flex-1">
          <span>Banco</span>
          <input name="banco" required placeholder="Bancolombia" className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo w-48">
          <span>Número</span>
          <input
            name="numero"
            required
            inputMode="numeric"
            placeholder="123-456789-01"
            className="aq-campo aq-cifra"
          />
        </label>

        <label className="aq-etiqueta-campo w-40">
          <span>Tipo</span>
          <select name="tipoDeCuentaBancaria" defaultValue="ahorros" className="aq-campo">
            <option value="ahorros">Ahorros</option>
            <option value="corriente">Corriente</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario justify-self-start"
      >
        {enviando ? 'Cargando…' : 'Cargar la cuenta'}
      </button>
    </form>
  )
}

/**
 * Desactivar una cuenta bancaria.
 *
 * Solo las bancarias y solo en cero: esconder una cuenta con plata haría bajar
 * el total del negocio sin un movimiento que lo explique (RN-GAS-09). El botón
 * dice por qué no se puede, en vez de aparecer apagado.
 */
export function CuentasBancarias({ cuentas }: { cuentas: CuentaConSaldo[] }) {
  const bancarias = cuentas.filter((c) => c.tipo === 'banco')

  if (bancarias.length === 0) return null

  return (
    <section className="grid gap-3">
      <h2 className="aq-micro text-tenue">
        {bancarias.length === 1 ? '1 cuenta bancaria' : `${bancarias.length} cuentas bancarias`}
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {bancarias.map((c) => (
          <li key={c.id}>
            <article className="aq-tarjeta grid h-full gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-semibold text-principal">{c.nombre}</p>
                {c.activa ? null : <Estado tono="expuesto">Inactiva</Estado>}
              </div>

              <p className="text-[13px] text-secundario">
                {c.banco} · {c.tipoDeCuentaBancaria === 'ahorros' ? 'Ahorros' : 'Corriente'}{' '}
                <span className="aq-cifra text-tenue">{c.numero}</span>
              </p>

              <p className="aq-cifra text-[15px] font-medium text-principal">{pesos(c.saldo)}</p>

              <CambiarEstadoDeCuenta cuenta={c} />
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CambiarEstadoDeCuenta({ cuenta }: { cuenta: CuentaConSaldo }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoDeCuentaAction, INICIAL)

  useAvisoDeExito(estado)

  const conPlata = aCentavos(cuenta.saldo) !== 0

  if (cuenta.activa && conPlata) {
    return (
      <p className="text-[12px] text-tenue">
        Para darla de baja, primero tiene que quedar en cero: una cuenta con plata no se esconde.
      </p>
    )
  }

  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="cuentaId" value={cuenta.id} />
      <input type="hidden" name="activa" value={cuenta.activa ? 'no' : 'si'} />
      <FormError id={`cuenta-${cuenta.id}`}>{estado.error}</FormError>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        {enviando ? 'Guardando…' : cuenta.activa ? 'Dar de baja' : 'Volver a activar'}
      </button>
    </form>
  )
}
