import { Estado, type Tono } from '@/components/ui/estado'
import { Cifra } from '@/components/stock/cifra'
import type { InsumoListado } from '@/lib/api-types'

/**
 * Cada insumo contra su mínimo.
 *
 * ── Por qué horizontales y por qué la escala es COMPARTIDA ──────────────────
 *
 * Horizontales porque las etiquetas son nombres —«Sello termoencogible»— y
 * verticales quedarían rotadas o cortadas.
 *
 * La escala la comparten todos los insumos, aunque tengan mínimos distintos.
 * Escalar cada barra a su propio máximo haría que dos saldos muy distintos se
 * vean iguales, que es la forma más común de que un gráfico mienta sin decir
 * nada falso.
 *
 * ── El umbral es una marca, no un color de fondo ────────────────────────────
 *
 * La pregunta no es «cuánto hay» sino «¿alcanza?». Esa respuesta la da la
 * posición de la barra respecto de una línea, y por eso el mínimo se dibuja
 * como una marca vertical en su valor: se ve de un vistazo de qué lado cayó.
 *
 * El color NO es el único canal. Cada fila lleva su insignia de estado con los
 * cuatro canales del sistema (R40) — con perder el color, la fila se sigue
 * leyendo.
 *
 * Es un Server Component: SVG plano, sin estado.
 */

const ALTO_FILA = 10
const RADIO = 2

/** El mismo criterio que usa la pantalla de insumos. Una regla, un lugar. */
function nivelDe(insumo: InsumoListado): Tono {
  if (insumo.saldo === 0) return 'expuesto'
  return insumo.bajoMinimo ? 'justo' : 'cubierto'
}

const QUE_SIGNIFICA: Record<Tono, string> = {
  cubierto: 'Alcanza',
  justo: 'Hay que pedir',
  expuesto: 'Sin unidades',
}

export function BarrasConUmbral({ insumos }: { insumos: InsumoListado[] }) {
  if (insumos.length === 0) return null

  /*
   * El techo contempla los MÍNIMOS además de los saldos: si todos los insumos
   * están por debajo de su mínimo, escalar solo por el saldo dejaría las marcas
   * de umbral fuera del dibujo — justo cuando más importan.
   */
  const techo = Math.max(...insumos.flatMap((i) => [i.saldo, i.minimo]), 1)

  return (
    <ul className="grid gap-4">
      {insumos.map((insumo) => {
        const nivel = nivelDe(insumo)
        const proporcion = insumo.saldo / techo
        const umbral = insumo.minimo / techo

        return (
          <li key={insumo.id} className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[14px] text-secundario">{insumo.nombre}</p>
              <p className="flex items-baseline gap-1.5">
                <Cifra tono={nivel === 'cubierto' ? 'principal' : 'alerta'}>
                  {insumo.saldo.toLocaleString('es-CO')}
                </Cifra>
                <span className="text-[13px] text-tenue">
                  · mínimo {insumo.minimo.toLocaleString('es-CO')}
                </span>
              </p>
            </div>

            <svg
              viewBox={`0 0 100 ${ALTO_FILA}`}
              preserveAspectRatio="none"
              className="h-2.5 w-full"
              role="img"
              aria-label={`${insumo.nombre}: ${insumo.saldo} unidades, mínimo ${insumo.minimo}. ${QUE_SIGNIFICA[nivel]}.`}
            >
              <rect
                x={0}
                y={0}
                width={100}
                height={ALTO_FILA}
                rx={RADIO}
                className="fill-sutil"
                opacity={0.5}
              />
              <rect
                x={0}
                y={0}
                width={Math.max(proporcion * 100, insumo.saldo > 0 ? 1 : 0)}
                height={ALTO_FILA}
                rx={RADIO}
                className={nivel === 'cubierto' ? 'fill-agua' : 'fill-alerta'}
              />
              {/* La marca del mínimo, por encima de la barra. */}
              <line
                x1={umbral * 100}
                x2={umbral * 100}
                y1={-1}
                y2={ALTO_FILA + 1}
                className="stroke-principal"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/*
              El `div` no es decorativo: `<Estado>` es un `inline-flex`, y un
              grid lo estira a todo el ancho por el `justify-items: stretch` que
              trae por defecto. La insignia terminaba de 1300 px — una barra
              verde enorme que ademas le daba a un estado normal el peso visual
              de una alarma. El envoltorio absorbe el estirado y la insignia
              vuelve a medir lo que dice.
            */}
            <div>
              <Estado tono={nivel}>{QUE_SIGNIFICA[nivel]}</Estado>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
