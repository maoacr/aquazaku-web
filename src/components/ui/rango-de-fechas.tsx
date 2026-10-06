'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { hoyEnLaPlanta } from '@/lib/hora-de-la-planta'

/**
 * El rango que manda sobre todo lo que hay debajo.
 *
 * ── Navega, no pide datos ───────────────────────────────────────────────────
 *
 * Cambia la URL y deja que el Server Component vuelva a consultar. El browser
 * nunca le habla a `api/` (ADR-0002), y además así el rango queda en la barra
 * de direcciones: se comparte por WhatsApp, se guarda en favoritos y el
 * «volver» del navegador funciona. Es el mismo patrón que
 * `modulos/reportes/filtros.tsx`.
 *
 * ── Las fechas salen del día de la PLANTA ───────────────────────────────────
 *
 * `hoyEnLaPlanta()` y no `new Date().toISOString()`. Colombia es UTC−5: a las
 * 19:00 de Campo de la Cruz el proceso en UTC ya pasó de medianoche, así que
 * «Hoy» pediría un día que todavía no empezó y el tablero saldría vacío. Es el
 * bug que motivó `hora-de-la-planta.ts`, y en `api/` lo encontró el CI.
 *
 * Una vez que tenemos el día de la planta como texto `AAAA-MM-DD`, la
 * aritmética es de CALENDARIO y no tiene zona: se arma con `Date.UTC` y se lee
 * con `toISOString`, los dos en UTC, así que no se cuela la zona del proceso.
 */

/** Los atajos, en el orden en que se usan. El rango va `[desde, hasta]`. */
const ATAJOS: { nombre: string; rango: (hoy: string) => [string, string] }[] = [
  { nombre: 'Hoy', rango: (h) => [h, h] },
  // Siete días son hoy y los SEIS anteriores. «Hoy menos siete» da ocho.
  { nombre: '7 días', rango: (h) => [sumarDias(h, -6), h] },
  { nombre: '30 días', rango: (h) => [sumarDias(h, -29), h] },
  { nombre: '2 meses', rango: (h) => [sumarDias(h, -59), h] },
  { nombre: 'Este mes', rango: (h) => [`${h.slice(0, 7)}-01`, h] },
  { nombre: 'Este año', rango: (h) => [`${h.slice(0, 4)}-01-01`, h] },
]

export function RangoDeFechas({ desde, hasta }: { desde: string; hasta: string }) {
  const router = useRouter()
  const params = useSearchParams()

  const [d, setD] = useState(desde)
  const [h, setH] = useState(hasta)

  const invertido = d > h
  const hoy = hoyEnLaPlanta()

  /*
   * Se parte de los parámetros ACTUALES y se pisan solo los dos del rango. El
   * tablero comparte la URL con la granularidad del gráfico: si el rango
   * reemplazara la query entera, tocar «30 días» tiraría abajo el corte que
   * alguien acababa de elegir.
   */
  const navegar = (nuevoDesde: string, nuevoHasta: string) => {
    const q = new URLSearchParams(params)
    q.set('desde', nuevoDesde)
    q.set('hasta', nuevoHasta)
    router.push(`?${q}`)
  }

  return (
    <div className="aq-tarjeta flex flex-wrap items-center gap-2.5 p-4">
      <div className="flex flex-wrap gap-1.5">
        {ATAJOS.map((atajo) => {
          const [ad, ah] = atajo.rango(hoy)
          const activo = ad === desde && ah === hasta

          return (
            <button
              key={atajo.nombre}
              type="button"
              // `aria-pressed` y no una clase: el estado tiene que llegarle a
              // quien no ve el color del botón.
              aria-pressed={activo}
              onClick={() => {
                setD(ad)
                setH(ah)
                navegar(ad, ah)
              }}
              className={`aq-boton aq-boton-compacto ${activo ? 'aq-boton-primario' : 'aq-boton-secundario'}`}
            >
              {atajo.nombre}
            </button>
          )
        })}
      </div>

      {/*
        ── El botón baja de renglón en teléfono ────────────────────────────────

        A 390 px los dos campos de fecha, la flecha y «Consultar» no entran en
        una fila: los campos se achicaban hasta cortar el año y se leía
        `07/09/`. Medido en el navegador — en jsdom no hay layout y esto pasaba
        invisible.

        Con `flex-wrap` y el botón a lo ancho, las fechas se quedan con toda la
        fila para ellas y el botón cae abajo, donde además es un objetivo
        táctil cómodo.
      */}
      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
        <label className="aq-etiqueta-campo min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Desde</span>
          <input
            type="date"
            value={d}
            max={h}
            onChange={(e) => setD(e.target.value)}
            className="aq-campo"
          />
        </label>

        <span aria-hidden className="text-tenue">
          →
        </span>

        <label className="aq-etiqueta-campo min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Hasta</span>
          <input
            type="date"
            value={h}
            min={d}
            onChange={(e) => setH(e.target.value)}
            className="aq-campo"
          />
        </label>

        <button
          type="button"
          onClick={() => navegar(d, h)}
          disabled={invertido}
          className="aq-boton aq-boton-primario w-full sm:w-auto sm:shrink-0"
        >
          Consultar
        </button>
      </div>

      {/*
        El rango invertido se frena AQUÍ además de en `api/`. Sin esto, el 422
        llega después de un viaje y con el tablero anterior todavía en pantalla
        — que se lee como si la consulta hubiera funcionado.

        Y se dice POR QUÉ el botón está apagado: un control deshabilitado sin
        motivo deja a quien lo mira sin saber qué arreglar.
      */}
      {invertido ? (
        <p className="w-full text-[13px] text-alerta-texto">
          El «desde» es posterior al «hasta». Así, la consulta no devolvería nada — y ese vacío
          se lee como «no hubo movimientos».
        </p>
      ) : null}
    </div>
  )
}

/**
 * Suma (o resta) días a un `AAAA-MM-DD`, en calendario puro.
 *
 * `Date.UTC` para construir y `toISOString` para leer: los dos son UTC, así que
 * la zona del proceso no entra en la cuenta. Hacerlo con `new Date(iso)` y
 * `getDate()` mezclaría la zona local y correría un día en media parte del
 * planeta.
 */
function sumarDias(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number) as [number, number, number]

  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}
