'use client'

import { Download, Printer } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { COLUMNAS, POR_DEFECTO } from '@/components/reportes/columnas'
import type { TipoDeMovimientoDePlata } from '@/lib/api-types'

/**
 * Los filtros del extracto — RN-CON-04 y 08.
 *
 * ── Navega, no pide datos ───────────────────────────────────────────────────
 *
 * Cambia la URL y deja que el Server Component vuelva a consultar. El browser
 * nunca le habla a `api/` (ADR-0002), y además así el rango, los tipos y las
 * columnas quedan en la barra de direcciones: se comparten, se guardan, y el
 * «volver» del navegador funciona.
 *
 * Eso también es lo que hace que el botón de CSV sea un enlace común: la URL de
 * la pantalla y la de la descarga llevan exactamente los mismos parámetros.
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
  columnas,
}: {
  desde: string
  hasta: string
  tipos: string
  columnas: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  const [d, setD] = useState(desde)
  const [h, setH] = useState(hasta)

  const tiposElegidos = new Set(tipos ? tipos.split(',').filter(Boolean) : [])
  const columnasElegidas = new Set(columnas ? columnas.split(',').filter(Boolean) : POR_DEFECTO)

  const invertido = d > h

  const navegar = (cambios: { tipos?: string; columnas?: string } = {}) => {
    const q = new URLSearchParams(params)
    q.set('desde', d)
    q.set('hasta', h)

    for (const [clave, valor] of Object.entries({ tipos, columnas, ...cambios })) {
      if (valor) q.set(clave, valor)
      else q.delete(clave)
    }

    router.push(`/modulos/reportes?${q}`)
  }

  const alternar = (conjunto: Set<string>, valor: string) => {
    const siguiente = new Set(conjunto)
    if (siguiente.has(valor)) siguiente.delete(valor)
    else siguiente.add(valor)
    return [...siguiente].join(',')
  }

  // La descarga lleva los mismos parámetros que la pantalla: lo que se ve es lo
  // que se baja.
  const descarga = new URLSearchParams(params)
  descarga.set('desde', desde)
  descarga.set('hasta', hasta)

  return (
    <div className="aq-tarjeta grid gap-5 p-5 print:hidden">
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
          onClick={() => navegar()}
          disabled={invertido}
          className="aq-boton aq-boton-primario"
        >
          Consultar
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/*
            Un enlace común, no un `fetch`: la descarga la maneja el navegador
            con su propia barra de progreso y su carpeta de siempre.
          */}
          <a
            href={`/modulos/reportes/exportar?${descarga}`}
            className="aq-boton aq-boton-secundario"
          >
            <Download aria-hidden className="size-4" />
            CSV
          </a>

          {/*
            El PDF lo hace el navegador con «Guardar como PDF». Así el archivo
            es exactamente lo que está en pantalla — y el contador elige el
            tamaño de papel, que ninguna librería del servidor puede adivinar.
          */}
          <button type="button" onClick={() => window.print()} className="aq-boton aq-boton-secundario">
            <Printer aria-hidden className="size-4" />
            Imprimir o PDF
          </button>
        </div>
      </div>

      {/*
        El rango invertido se frena ACÁ además de en el servidor. Sin esto, el
        error llega después de un viaje y con el reporte anterior todavía en
        pantalla, que se lee como si la consulta hubiera funcionado.
      */}
      {invertido ? (
        <p className="text-[13px] text-alerta">
          El «desde» es posterior al «hasta». Así, la consulta no devolvería nada — y ese vacío se
          lee como «no hubo movimientos».
        </p>
      ) : null}

      <Grupo titulo="Mostrar">
        {TIPOS.map((t) => (
          <Pastilla
            key={t.valor}
            etiqueta={t.etiqueta}
            activa={tiposElegidos.size === 0 || tiposElegidos.has(t.valor)}
            onClick={() => navegar({ tipos: alternar(tiposElegidos, t.valor) })}
          />
        ))}
        {tiposElegidos.size === 0 ? (
          <span className="text-[13px] text-tenue">Todos los movimientos.</span>
        ) : null}
      </Grupo>

      <Grupo titulo="Columnas">
        {COLUMNAS.map((c) => (
          <Pastilla
            key={c.clave}
            etiqueta={c.etiqueta}
            activa={columnasElegidas.has(c.clave)}
            /*
             * El monto no se puede quitar. Un extracto sin montos no es un
             * extracto más corto: es una lista de fechas con aspecto de reporte
             * financiero. La regla vive en `columnasVisibles`, así que el CSV
             * tampoco puede salir sin ella — esto solo lo hace visible.
             */
            fija={c.clave === 'monto'}
            onClick={() => navegar({ columnas: alternar(columnasElegidas, c.clave) })}
          />
        ))}
      </Grupo>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="aq-micro w-20 text-tenue">{titulo}</span>
      {children}
    </div>
  )
}

function Pastilla({
  etiqueta,
  activa,
  fija,
  onClick,
}: {
  etiqueta: string
  activa: boolean
  fija?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={fija}
      aria-pressed={activa}
      title={fija ? 'El monto va siempre: sin él, el extracto no dice nada' : undefined}
      className={`aq-boton aq-boton-compacto aq-boton-secundario ${activa ? '' : 'opacity-50'} ${
        fija ? 'cursor-not-allowed' : ''
      }`}
    >
      {etiqueta}
    </button>
  )
}
