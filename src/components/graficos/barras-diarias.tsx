import type { CierreDeProduccion } from '@/lib/api-types'

/**
 * Litros que salieron del tanque procesado, día por día.
 *
 * ── Por qué UNA serie y no las tres del envasado ────────────────────────────
 *
 * La tentación era apilar pacas de 600, pacas de 300 y botellones. Dos razones
 * para no hacerlo:
 *
 * 1. **No son la misma unidad.** Una paca trae 20 bolsas y un botellón es uno.
 *    Sumarlos da un número que no significa nada, y apilarlos invita a
 *    compararlos como si fueran comparables.
 * 2. **Tres segmentos apilados se distinguen solo por color**, que es
 *    exactamente el problema que el sistema resuelve con cuatro canales en el
 *    semáforo (R40). Cerca del 8 % de los varones no separa el par verde/azul,
 *    y al sol en la planta no lo separa nadie.
 *
 * Los litros SÍ son una unidad común, están siempre —no dependen del caudal— y
 * contestan la pregunta que alguien se hace mirando: cuánto salió cada día.
 *
 * ── Los días sin caudal no se dibujan en cero ───────────────────────────────
 *
 * `litrosProcesados` es `null` mientras nadie mida el caudal (pregunta 4). Un
 * cero diría «ese día no se procesó nada», que es otra cosa. Se marca con un
 * punto tenue: hubo cierre, falta el dato.
 *
 * Es un Server Component: SVG plano, sin estado. Se pinta en el servidor.
 */

const CAJA = { ancho: 640, alto: 160 }
const MARGEN = { arriba: 12, abajo: 26, izquierda: 4, derecha: 4 }
const ALTO_UTIL = CAJA.alto - MARGEN.arriba - MARGEN.abajo

/** Cuántos días entran sin que las barras queden hilos. */
export const DIAS_VISIBLES = 14

export function BarrasDiarias({ cierres }: { cierres: CierreDeProduccion[] }) {
  // `/produccion` viene del más nuevo al más viejo; un eje de tiempo va al revés.
  const dias = [...cierres].slice(0, DIAS_VISIBLES).reverse()

  if (dias.length === 0) return null

  const techo = Math.max(...dias.map((d) => d.litrosConsumidos), 1)
  const anchoUtil = CAJA.ancho - MARGEN.izquierda - MARGEN.derecha
  const paso = anchoUtil / dias.length
  const anchoBarra = Math.min(38, paso * 0.62)

  const alturaDe = (litros: number) => (litros / techo) * ALTO_UTIL

  return (
    <figure className="grid gap-2">
      <svg
        viewBox={`0 0 ${CAJA.ancho} ${CAJA.alto}`}
        className="h-auto w-full"
        role="img"
        aria-label={descripcion(dias)}
      >
        {/* La línea de base ancla las barras: sin ella flotan. */}
        <line
          x1={MARGEN.izquierda}
          x2={CAJA.ancho - MARGEN.derecha}
          y1={MARGEN.arriba + ALTO_UTIL}
          y2={MARGEN.arriba + ALTO_UTIL}
          className="stroke-sutil"
          strokeWidth={1}
        />

        {dias.map((dia, i) => {
          const centro = MARGEN.izquierda + paso * i + paso / 2
          const alto = alturaDe(dia.litrosConsumidos)
          const base = MARGEN.arriba + ALTO_UTIL

          return (
            <g key={dia.id}>
              <rect
                x={centro - anchoBarra / 2}
                y={base - alto}
                width={anchoBarra}
                height={Math.max(alto, 1)}
                rx={2}
                className="fill-agua"
                opacity={0.75}
              />

              {/*
                El procesamiento, cuando se sabe. Va como marca sobre la barra y
                no como una segunda barra: es otro hecho del mismo día, no otra
                categoría que competir por el espacio.
              */}
              {dia.litrosProcesados === null ? (
                <circle
                  cx={centro}
                  cy={base - alto - 6}
                  r={1.6}
                  className="fill-tenue"
                  opacity={0.6}
                />
              ) : (
                <line
                  x1={centro - anchoBarra / 2 - 2}
                  x2={centro + anchoBarra / 2 + 2}
                  y1={base - alturaDe(dia.litrosProcesados)}
                  y2={base - alturaDe(dia.litrosProcesados)}
                  className="stroke-principal"
                  strokeWidth={1.5}
                />
              )}

              <text
                x={centro}
                y={CAJA.alto - 8}
                textAnchor="middle"
                className="fill-tenue text-[10px]"
              >
                {diaDelMes(dia.fecha)}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-tenue">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-3 rounded-[2px] bg-agua opacity-75" />
          Litros que salieron del tanque
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 bg-principal" />
          Litros procesados
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-tenue opacity-60" />
          Sin caudal medido
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * «el último cierre» / «los últimos 9 cierres».
 *
 * Sin el «(s)» que nadie escribe hablando — es la misma regla que sigue el
 * tablero para contar productos.
 */
export function cuantosCierres(cantidad: number): string {
  return cantidad === 1 ? 'el último cierre' : `los últimos ${cantidad} cierres`
}

/** `2026-08-26` → `26`. Sin `Date`: parsearlo arrastraría husos. */
function diaDelMes(fecha: string): string {
  return fecha.slice(8, 10)
}

/**
 * Lo que escucha un lector de pantalla.
 *
 * Un gráfico descrito como «gráfico de barras» no le sirve a nadie. Esto dice
 * el rango, el total y cuántos días les falta el caudal — que es la conclusión
 * accionable.
 */
function descripcion(dias: CierreDeProduccion[]): string {
  const total = dias.reduce((suma, d) => suma + d.litrosConsumidos, 0)
  const sinCaudal = dias.filter((d) => d.litrosProcesados === null).length

  const cuantos =
    dias.length === 1 ? 'el último cierre' : `los últimos ${dias.length} cierres`

  const base = `Litros consumidos por día en ${cuantos}: ${total.toLocaleString('es-CO')} litros en total.`

  if (sinCaudal === 0) return base

  return `${base} ${sinCaudal === dias.length ? 'Ninguno' : `${sinCaudal} de esos días no`} tiene el caudal medido, así que no se sabe cuánta agua se procesó.`
}
