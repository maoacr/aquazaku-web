'use client'

import { useActionState, useState } from 'react'
import {
  ajustarLoteAction,
  descartarAction,
  registrarEntradaAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/stock/actions'
import { FormError } from '@/components/auth/form-error'
import type { LoteConSaldo, ResumenDeStock } from '@/lib/api-types'
import { LARGO_MINIMO_MOTIVO } from '@/lib/motivos'

const INICIAL: EstadoDeFormulario = {}

const campo =
  'rounded-md border border-fuerte bg-tarjeta px-3 py-2 text-principal placeholder:text-tenue'

/** Alto mínimo 44px; los primarios, 56px. Regla táctil del sistema. */
const botonPrimario =
  'h-14 rounded-md bg-accion px-5 font-semibold text-invertido hover:bg-accion-hover disabled:opacity-50'

function Resultado({ estado }: { estado: EstadoDeFormulario }) {
  return (
    <>
      <FormError id="stock-error">{estado.error}</FormError>
      {estado.ok ? (
        // Verde reservado: acá sí significa "quedó registrado y cuadra".
        <p
          role="status"
          className="rounded-md border border-exito-borde bg-exito-fondo px-3 py-2 text-[14px] text-exito-texto"
        >
          {estado.ok}
        </p>
      ) : null}
    </>
  )
}

/**
 * Campo de motivo con su mínimo a la vista.
 *
 * El contador se muestra **siempre**, no solo cuando falta: enterarse del
 * mínimo al ser rechazado obliga a reescribir lo que ya se pensó.
 */
function CampoDeMotivo({
  nombre = 'motivo',
  etiqueta = 'Motivo',
  ayuda,
}: {
  nombre?: string
  etiqueta?: string
  ayuda: string
}) {
  const [texto, setTexto] = useState('')
  const faltan = LARGO_MINIMO_MOTIVO - texto.trim().length

  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-semibold text-principal">{etiqueta}</span>
      <textarea
        name={nombre}
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className={campo}
        placeholder={ayuda}
      />
      <span className="text-[13px] text-tenue">
        {faltan > 0
          ? `Faltan ${faltan} caracteres. Tiene que servir para entender el registro dentro de tres meses.`
          : 'Suficiente.'}
      </span>
    </label>
  )
}

export function EntradaDeInventario({ productos }: { productos: ResumenDeStock[] }) {
  const [estado, accion, enviando] = useActionState(registrarEntradaAction, INICIAL)
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <form action={accion} className="grid gap-4 rounded-lg border border-sutil bg-tarjeta p-5 shadow-elev-1">
      <h2 className="text-[20px] font-semibold text-principal">Registrar entrada de inventario</h2>
      <p className="text-[14px] text-secundario">
        Crea un lote nuevo. El código y el vencimiento los genera el sistema — no se escriben.
      </p>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">Producto</span>
          <select name="productoId" required defaultValue="" className={campo}>
            <option value="" disabled>
              Elegí uno
            </option>
            {productos.map((p) => (
              <option key={p.productoId} value={p.productoId}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">Unidades</span>
          <input name="cantidad" type="number" min={1} step={1} required className={`${campo} aq-cifra`} />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">Fecha de empaque</span>
          <input
            name="fechaEmpaque"
            type="date"
            defaultValue={hoy}
            required
            className={`${campo} aq-cifra`}
          />
        </label>
      </div>

      <CampoDeMotivo ayuda="Por ejemplo: carga inicial del inventario de agosto" />

      <div>
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? 'Registrando…' : 'Registrar entrada'}
        </button>
      </div>
    </form>
  )
}

export function AjusteDeLote({ lotes }: { lotes: LoteConSaldo[] }) {
  const [estado, accion, enviando] = useActionState(ajustarLoteAction, INICIAL)

  return (
    <form action={accion} className="grid gap-4 rounded-lg border border-sutil bg-tarjeta p-5 shadow-elev-1">
      <h2 className="text-[20px] font-semibold text-principal">Ajustar un lote</h2>
      <p className="text-[14px] text-secundario">
        El conteo físico siempre difiere. Positivo si sobran unidades, negativo si faltan.
      </p>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeLote lotes={lotes} />

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">Diferencia</span>
          <input
            name="cantidad"
            type="number"
            step={1}
            required
            placeholder="-8"
            className={`${campo} aq-cifra`}
          />
        </label>
      </div>

      <CampoDeMotivo ayuda="Por ejemplo: conteo físico del lunes, faltaban 8 unidades" />

      <div>
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? 'Ajustando…' : 'Registrar ajuste'}
        </button>
      </div>
    </form>
  )
}

export function DescarteDeLote({ lotes }: { lotes: LoteConSaldo[] }) {
  const [estado, accion, enviando] = useActionState(descartarAction, INICIAL)
  const [causa, setCausa] = useState('')

  return (
    <form action={accion} className="grid gap-4 rounded-lg border border-sutil bg-tarjeta p-5 shadow-elev-1">
      <h2 className="text-[20px] font-semibold text-principal">Descartar unidades</h2>
      <p className="text-[14px] text-secundario">
        Selectivo por unidad: descartar no destruye el lote entero.
      </p>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectorDeLote lotes={lotes} />

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">Unidades</span>
          <input name="cantidad" type="number" min={1} step={1} required className={`${campo} aq-cifra`} />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">Causa</span>
          <select
            name="causa"
            required
            value={causa}
            onChange={(e) => setCausa(e.target.value)}
            className={campo}
          >
            <option value="" disabled>
              Elegí una
            </option>
            <option value="falla_produccion">Falla de producción</option>
            <option value="mal_manejo_cliente">Mal manejo del cliente</option>
            <option value="vencido">Vencido</option>
            <option value="otro">Otro</option>
          </select>
        </label>
      </div>

      {/*
        Las otras tres causas ya dicen qué pasó. "Otro" no dice nada, así que
        el campo aparece y pasa a ser obligatorio.
      */}
      {causa === 'otro' ? (
        <CampoDeMotivo
          nombre="observaciones"
          etiqueta="Qué pasó"
          ayuda="Por ejemplo: se cayeron del estante al mover la estiba"
        />
      ) : (
        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-principal">
            Observaciones <span className="font-normal text-tenue">(opcional)</span>
          </span>
          <input name="observaciones" className={campo} />
        </label>
      )}

      <div>
        <button
          type="submit"
          disabled={enviando}
          className="h-14 rounded-md bg-destructiva px-5 font-semibold text-invertido disabled:opacity-50"
        >
          {enviando ? 'Descartando…' : 'Registrar descarte'}
        </button>
      </div>
    </form>
  )
}

function SelectorDeLote({ lotes }: { lotes: LoteConSaldo[] }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-semibold text-principal">Lote</span>
      <select name="loteId" required defaultValue="" className={campo}>
        <option value="" disabled>
          Elegí uno
        </option>
        {lotes.map((l) => (
          <option key={l.id} value={l.id}>
            {l.codigo} — {l.saldo} unidades — vence {l.fechaVencimiento}
          </option>
        ))}
      </select>
    </label>
  )
}
