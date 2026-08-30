'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { TipoDeMovimientoDePlata } from '@/lib/api-types'

/**
 * El filtro del extracto — RN-CON-04.
 *
 * ── Navega, no pide datos ──────────────────────────────────────────────────
 *
 * Cambia la URL y deja que el Server Component vuelva a consultar. El browser
 * nunca le habla a `api` (ADR-0002), y además así el rango queda en la barra de
 * direcciones: se comparte, se guarda y el «volver» funciona.
 */

const TIPOS: { valor: TipoDeMovimientoDePlata; etiqueta: string }[] = [
  { valor: 'venta', etiqueta: 'Ventas' },
  { valor: 'cobro', etiqueta: 'Cobros' },
  { valor: 'compra', etiqueta: 'Compras' },
  { valor: 'devolucion', etiqueta: 'Devoluciones' },
  { valor: 'recargo', etiqueta: 'Recargos por daño' },
]

export function Filtros({
  desde,
  hasta,
  tipos,
}: {
  desde: string
  hasta: string
  tipos: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  const [d, setD] = useState(desde)
  const [h, setH] = useState(hasta)
  const elegidos = new Set(tipos ? tipos.split(',') : [])

  const invertido = d > h

  const aplicar = (extra?: { tipos?: string }) => {
    const q = new URLSearchParams(params)
    q.set('desde', d)
    q.set('hasta', h)

    const t = extra?.tipos ?? tipos
    if (t) q.set('tipos', t)
    else q.delete('tipos')

    router.push(`/modulos/reportes?${q}`)
  }

  const alternar = (valor: string) => {
    const siguiente = new Set(elegidos)
    if (siguiente.has(valor)) siguiente.delete(valor)
    else siguiente.add(valor)
    aplicar({ tipos: [...siguiente].join(',') })
  }

  return (
    <div className="aq-tarjeta grid gap-4 p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo">
          <span>Desde</span>
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Hasta</span>
          <input type="date" value={h} onChange={(e) => setH(e.target.value)} className="aq-campo" />
        </label>

        <button
          type="button"
          onClick={() => aplicar()}
          disabled={invertido}
          className="aq-boton aq-boton-primario"
        >
          Consultar
        </button>
      </div>

      {/*
        El rango invertido se frena ACÁ además de en el servidor. No es
        duplicación ociosa: sin esto, el error llega después de un viaje y con
        el reporte anterior todavía en pantalla, que se lee como si la consulta
        hubiera funcionado.
      */}
      {invertido ? (
        <p className="text-[13px] text-alerta">
          El «desde» es posterior al «hasta». Así, la consulta no devolvería nada — y ese vacío se
          lee como «no hubo movimientos».
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="aq-micro text-tenue">Mostrar</span>
        {TIPOS.map((t) => {
          const activo = elegidos.size === 0 || elegidos.has(t.valor)
          return (
            <button
              key={t.valor}
              type="button"
              onClick={() => alternar(t.valor)}
              aria-pressed={activo}
              className={`aq-boton aq-boton-compacto ${
                activo ? 'aq-boton-secundario' : 'aq-boton-secundario opacity-50'
              }`}
            >
              {t.etiqueta}
            </button>
          )
        })}
      </div>

      {/* Sin ninguno elegido, vienen todos: es lo mismo y evita un estado vacío. */}
      <p className="text-[13px] text-tenue">
        {elegidos.size === 0 ? 'Se muestran todos los movimientos.' : null}
      </p>
    </div>
  )
}
