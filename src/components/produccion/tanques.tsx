'use client'

import { Droplets } from 'lucide-react'
import { useActionState, useId, useState } from 'react'
import {
  ajustarAguaAction,
  type EstadoDeFormulario,
  registrarReposicionAction,
} from '@/app/(app)/modulos/produccion/actions'
import { FormError } from '@/components/auth/form-error'
import { Cifra } from '@/components/stock/cifra'
import type { NivelDeTanque, SaldoDeAgua, Tanque } from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

const NOMBRE: Record<Tanque, string> = {
  crudo: 'Agua cruda',
  procesado: 'Agua procesada',
}

const EXPLICACION: Record<Tanque, string> = {
  crudo: 'Lo que llega de la red municipal, antes de tratar.',
  // Dos tanques de 2.000 L que se operan en PARALELO, no uno detrás del otro
  // (RN-PRD-21): por eso el saldo es uno solo de 4.000.
  procesado: 'Lista para envasar. Son dos tanques de 2.000 L que se usan en paralelo.',
}

const TEXTO_DE_NIVEL: Record<NivelDeTanque, string> = {
  vacio: 'vacío',
  un_cuarto: 'un cuarto',
  medio: 'medio',
  tres_cuartos: 'tres cuartos',
  lleno: 'lleno',
}

export function Tanques({ saldos }: { saldos: SaldoDeAgua[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {saldos.map((saldo) => (
        <li key={saldo.tanque}>
          <TarjetaDeTanque saldo={saldo} />
        </li>
      ))}
    </ul>
  )
}

/**
 * El saldo de un tanque, con el nivel al lado.
 *
 * ── Los dos números dicen cosas distintas ───────────────────────────────────
 *
 * Los litros son lo que dice el LIBRO, y ese manda (RN-PRD-14). El nivel es a
 * qué se parecería eso mirando el tanque, y sirve para una sola cosa: poder
 * compararlo con lo que se ve. Si el libro dice «medio» y el tanque se ve
 * lleno, hay algo sin registrar.
 *
 * Por eso el nivel se muestra como texto y no como una barra llena de color: no
 * es una medición, es una traducción del número a algo que el ojo pueda
 * contrastar.
 */
function TarjetaDeTanque({ saldo }: { saldo: SaldoDeAgua }) {
  const proporcion = saldo.capacidad === 0 ? 0 : saldo.litros / saldo.capacidad

  return (
    <article className="aq-tarjeta grid h-full gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="aq-titulo-tarjeta text-principal">{NOMBRE[saldo.tanque]}</p>
          <p className="mt-0.5 text-[13px] text-tenue">{EXPLICACION[saldo.tanque]}</p>
        </div>
        <Droplets aria-hidden className="size-5 shrink-0 text-icono" />
      </div>

      {/*
        El tono de la cifra sigue al dato. Un saldo negativo en el celeste del
        agua —que en este sistema significa «esto es agua y está bien»— diría
        con el color lo contrario de lo que dice el texto de abajo, y el número
        grande es lo primero que se mira.
      */}
      <p className="flex items-baseline gap-2">
        <Cifra tono={saldo.litros < 0 ? 'alerta' : 'agua'} tamano="grande">
          {saldo.litros.toLocaleString('es-CO')}
        </Cifra>
        <span className="text-[13px] text-tenue">
          de {saldo.capacidad.toLocaleString('es-CO')} L
        </span>
      </p>

      {/*
        La barra acompaña al número; no lo reemplaza. `aria-hidden` porque el
        dato ya está dicho arriba en litros, que es más preciso que cualquier
        barra.
      */}
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-sutil">
        <div
          className={`h-full rounded-full ${saldo.litros < 0 ? 'bg-alerta' : 'bg-agua'}`}
          style={{ width: `${Math.min(100, Math.max(0, proporcion * 100))}%` }}
        />
      </div>

      {/*
        ── Un saldo negativo NO es un tanque vacío ──────────────────────────
        Es un libro al que se le perdió una entrada, y decir «vacío» esconde
        justamente eso: se lee como una situación normal cuando es una
        discrepancia. Pasa de forma esperable —el ingreso de la red se
        registra sin cantidad (RN-PRD-11), así que hasta el primer ajuste el
        consumo baja un saldo que nunca subió— y por eso el mensaje dice qué
        hacer en vez de solo marcar el problema.
      */}
      {saldo.litros < 0 ? (
        <p className="text-[13px] text-secundario">
          <strong className="font-medium text-alerta-texto">El libro quedó corto</strong> en{' '}
          <Cifra tono="alerta">{Math.abs(saldo.litros).toLocaleString('es-CO')}</Cifra> L. Se
          consumió agua que nunca se registró entrando: mire el nivel real y ajuste el saldo.
        </p>
      ) : (
        <p className="text-[13px] text-secundario">
          El libro lo pone en{' '}
          <strong className="font-medium text-principal">
            {TEXTO_DE_NIVEL[saldo.nivelCalculado]}
          </strong>
          . Si el tanque se ve distinto, hay algo sin registrar.
        </p>
      )}
    </article>
  )
}

/**
 * «Llegó agua y se llenó el tanque» — **sin cantidad**, y eso es RN-PRD-11.
 *
 * No hay medidor ni regleta. El formulario no pide litros a propósito: si los
 * pidiera, alguien los completaría a ojo y el sistema convertiría un hueco
 * conocido en un número que parece medido. El día que el saldo no cuadre, nadie
 * sabría si el problema fue el consumo, la merma o esa estimación.
 *
 * El saldo sube después, con el ajuste de abajo, que exige motivo.
 */
export function RegistrarReposicion() {
  const [estado, accion, enviando] = useActionState(registrarReposicionAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Llegó agua de la red</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Solo se anota el hecho. No pedimos litros porque no hay con qué medirlos, y un
          número puesto a ojo ensucia el balance para siempre.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo">
          <span>Tanque</span>
          <select name="tanque" defaultValue="crudo" className="aq-campo">
            <option value="crudo">Agua cruda</option>
            <option value="procesado">Agua procesada</option>
          </select>
        </label>

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario">
          {enviando ? 'Anotando…' : 'Anotar'}
        </button>
      </div>
    </form>
  )
}

/**
 * Ajustar el saldo de un tanque — solo `admin`.
 *
 * ── Por qué esto es un permiso aparte del de reposición ─────────────────────
 *
 * Registrar que llegó agua es contar un HECHO que se observó. Corregir un saldo
 * que no cuadra es otra cosa, y quien opera la planta no debería poder tapar su
 * propia discrepancia. Por eso `tanques:ajustar` es del `admin` y
 * `tanques:registrar_reposicion` lo tiene también el `pos`.
 *
 * El motivo es obligatorio: un ajuste que nadie pueda explicar dentro de tres
 * meses no sirve como registro.
 */
export function AjustarAgua({ saldos }: { saldos: SaldoDeAgua[] }) {
  const [estado, accion, enviando] = useActionState(ajustarAguaAction, INICIAL)
  const idError = useId()

  const [tanque, setTanque] = useState<Tanque>('crudo')
  const [litros, setLitros] = useState('')
  const [motivo, setMotivo] = useState('')

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => {
    setLitros('')
    setMotivo('')
  })

  const actual = saldos.find((s) => s.tanque === tanque)
  const diferencia = litros.trim() === '' ? 0 : Number(litros)
  const quedaria = actual === undefined ? null : actual.litros + diferencia

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Ajustar el saldo</h2>
        <p className="mt-1 text-[13px] text-tenue">
          La diferencia va con signo: positivo si sobra, negativo si falta. Un cero no
          ajusta nada.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Tanque</span>
          <select
            name="tanque"
            value={tanque}
            onChange={(e) => setTanque(e.target.value as Tanque)}
            className="aq-campo"
          >
            <option value="crudo">Agua cruda</option>
            <option value="procesado">Agua procesada</option>
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Diferencia en litros</span>
          <input
            name="litros"
            type="number"
            required
            step="1"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            className="aq-campo"
          />
        </label>
      </div>

      <label className="aq-etiqueta-campo">
        <span>Motivo</span>
        <textarea
          name="motivo"
          required
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Llegó agua de la red y el tanque quedó a medio llenar"
          className="aq-campo"
        />
      </label>

      {/* El resultado antes de confirmar: un signo invertido es fácil de tipear
          y difícil de descubrir después. */}
      {quedaria !== null && diferencia !== 0 ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-sutil px-3 py-2 text-[14px] text-principal"
        >
          El tanque queda en <Cifra tono="agua">{quedaria.toLocaleString('es-CO')}</Cifra> L
          {actual ? ` de ${actual.capacidad.toLocaleString('es-CO')}` : ''}.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar el ajuste'}
      </button>
    </form>
  )
}
