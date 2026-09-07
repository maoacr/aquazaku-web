'use client'

import { useActionState } from 'react'
import { cambiarUmbralAction } from '@/app/(app)/modulos/alertas/actions'
import { useAvisoDeExito } from '@/lib/formulario-cliente'
import type { Parametro } from '@/lib/api-types'

/**
 * Los umbrales de las alertas — M12, RN-STK-11.
 *
 * ── La pantalla no sabe qué parámetros existen ──────────────────────────────
 *
 * La etiqueta, la ayuda, la unidad y los límites vienen del servidor. Un
 * parámetro nuevo aparece acá con solo agregarlo en una migración: sin tocar
 * `web`, sin desplegar el frontend.
 *
 * Lo mismo con los límites del campo. Copiarlos sería un tercer lugar con los
 * mismos números —el CHECK, la fila y este componente— y el día que cambien,
 * dos van a discrepar en silencio.
 */
export function Umbrales({ parametros }: { parametros: Parametro[] }) {
  return (
    <div className="grid gap-4">
      {parametros.map((p) => (
        <Umbral key={p.clave} parametro={p} />
      ))}
    </div>
  )
}

function Umbral({ parametro: p }: { parametro: Parametro }) {
  const [estado, accion, enviando] = useActionState(cambiarUmbralAction, {})
  useAvisoDeExito(estado)

  return (
    <form action={accion} className="aq-tarjeta grid gap-3 p-5">
      <input type="hidden" name="clave" value={p.clave} />

      <div>
        <h2 className="text-[15px] font-semibold text-principal">{p.etiqueta}</h2>
        <p className="mt-1 text-[13px] text-secundario">{p.ayuda}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="aq-etiqueta-campo">
          <span>
            {p.unidad} (entre {p.minimo} y {p.maximo})
          </span>
          <input
            name="valor"
            type="number"
            inputMode="numeric"
            defaultValue={p.valor}
            min={p.minimo}
            max={p.maximo}
            required
            aria-describedby={estado.error ? `${p.clave}-error` : undefined}
            className="aq-campo w-32"
          />
        </label>

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-primario">
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/*
        El error se queda junto al campo, no se va como toast: un error que
        desaparece obliga a recordar qué decía mientras se corrige.
      */}
      {estado.error && (
        <p id={`${p.clave}-error`} role="alert" className="text-[13px] text-alerta">
          {estado.error}
        </p>
      )}
    </form>
  )
}
