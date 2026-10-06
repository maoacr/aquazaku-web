'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { pesos, pesosCortos } from '@/lib/plata'
import { useSyncExternalStore } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Vendido contra cobrado, en el tiempo.
 *
 * ── La ÚNICA isla cliente del tablero ───────────────────────────────────────
 *
 * Todo lo demás —los indicadores, las barras, la composición— se pinta en el
 * servidor y no manda un byte de JavaScript. Aquí sí hace falta: el tooltip que
 * sigue al dedo sobre treinta puntos, con soporte táctil y acceso por teclado,
 * es bastante superficie para hacerla a mano y equivocarse.
 *
 * El panel que la envuelve —el título, la bajada, la leyenda— sigue siendo
 * Server Component: `'use client'` es una FRONTERA, y lo que entra al bundle es
 * lo que este archivo IMPORTA, no lo que lo rodea.
 *
 * ── Los datos llegan agregados, los tres cortes de una ──────────────────────
 *
 * El servidor manda `porDia`, `porSemana` y `porMes` ya calculados. Podría
 * mandar solo uno, pero entonces cambiar el corte sería un viaje al servidor y
 * una espera para ver los mismos datos agrupados distinto. Son tres arreglos de
 * a lo sumo unas decenas de filas: viajan juntos y el conmutador es inmediato.
 *
 * Y resuelve el default por pantalla, que el servidor NO puede decidir: no sabe
 * el ancho del viewport.
 *
 * ── El formateador se IMPORTA, no llega por prop ───────────────────────────
 *
 * La primera versión recibía `formatearMonto` como prop para que el gráfico no
 * supiera de pesos. Next lo rechazó en runtime y tenía razón:
 *
 *     Functions cannot be passed directly to Client Components
 *
 * Las props que cruzan la frontera tienen que ser SERIALIZABLES, y una función
 * no lo es. No lo atrapó ningún test —jsdom no cruza la frontera RSC—, ni el
 * typecheck, ni el lint: salió al abrir la página.
 *
 * `lib/plata.ts` es un módulo común, así que el cliente lo importa igual que lo
 * importa el servidor. Si algún día hace falta un gráfico que no sea de plata,
 * se parametriza con un descriptor serializable, no con una función.
 */

export type Granularidad = 'dia' | 'semana' | 'mes'

const GRANULARIDADES: Granularidad[] = ['dia', 'semana', 'mes']

const ETIQUETA: Record<Granularidad, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
}

export interface PuntoDeLaSerie {
  /** Ya formateado para el eje: «4 sep», «sem. 36», «septiembre». */
  etiqueta: string
  vendido: number
  cobrado: number
}

/**
 * Qué corte mostrar.
 *
 * ── Por qué el ancho decide, y por qué solo decide el DEFAULT ───────────────
 *
 * Treinta barras diarias en los 335 px útiles de un teléfono dan 11 px por
 * punto: no se leen, y el tooltip es imposible de apuntar con el dedo. En
 * teléfono se arranca en SEMANA — mismo rango, cuatro columnas gordas.
 *
 * Pero el ancho solo pone el default. Lo que el usuario elige viaja en la URL y
 * gana siempre: si el ancho pisara la elección, tocar «Día» en un teléfono no
 * haría nada y el control se vería roto.
 *
 * Es una función pura y exportada a propósito: es la única parte de este
 * componente que se puede probar de verdad. El dibujo necesita layout, y en
 * jsdom no hay.
 */
export function elegirGranularidad({
  deLaUrl,
  pantallaAngosta,
}: {
  deLaUrl: string | undefined
  pantallaAngosta: boolean
}): Granularidad {
  // Un valor inventado —la URL la escribe cualquiera— cae al default en vez de
  // dejar el gráfico en blanco.
  if (deLaUrl && (GRANULARIDADES as string[]).includes(deLaUrl)) {
    return deLaUrl as Granularidad
  }

  return pantallaAngosta ? 'semana' : 'dia'
}

/** El corte de «angosta». Coincide con `sm:` de Tailwind. */
const ANGOSTA = '(max-width: 639px)'

/**
 * El ancho, sin romper el render del servidor.
 *
 * `useSyncExternalStore` y no `useEffect`: el tercer argumento es el valor que
 * se usa en el SERVIDOR, donde no existe `window`. Con `useEffect` el primer
 * render saldría siempre con el default de escritorio y el teléfono vería el
 * gráfico cambiar solo después de hidratar — un parpadeo que se lee como un bug.
 *
 * Aquí el servidor asume `false` (escritorio) y el cliente corrige en el primer
 * render sincrónico, antes de pintar.
 */
function usePantallaAngosta(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(ANGOSTA)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    () => window.matchMedia(ANGOSTA).matches,
    () => false,
  )
}

export function SerieEnElTiempo({
  porDia,
  porSemana,
  porMes,
}: {
  porDia: PuntoDeLaSerie[]
  porSemana: PuntoDeLaSerie[]
  porMes: PuntoDeLaSerie[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const angosta = usePantallaAngosta()

  const granularidad = elegirGranularidad({
    deLaUrl: params.get('granularidad') ?? undefined,
    pantallaAngosta: angosta,
  })

  const datos = { dia: porDia, semana: porSemana, mes: porMes }[granularidad]

  const cambiar = (g: Granularidad) => {
    const q = new URLSearchParams(params)
    q.set('granularidad', g)
    router.push(`?${q}`)
  }

  return (
    <div className="grid gap-3">
      <div
        role="group"
        aria-label="Agrupar por"
        className="ml-auto flex gap-1 rounded-lg bg-elevada p-1"
      >
        {GRANULARIDADES.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={g === granularidad}
            onClick={() => cambiar(g)}
            className={`aq-boton aq-boton-compacto ${g === granularidad ? 'aq-boton-primario' : 'aq-boton-secundario'}`}
          >
            {ETIQUETA[g]}
          </button>
        ))}
      </div>

      {/*
        Alto FIJO y ancho 100 %: así lo hace Recharts y es lo correcto. Con una
        relación de aspecto, el gráfico se achata en un teléfono —860×240
        encogido a 375 px da 93 px de alto— y deja de leerse. Con alto fijo, en
        el teléfono mide 335×260: angosto y alto, que es lo que entra.
      */}
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {/* El degradado baja a cero: un relleno parejo tapa la serie de
                  atrás, y aquí las dos se superponen a propósito. */}
              <linearGradient id="aq-vendido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accion)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-accion)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aq-cobrado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-exito)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--color-exito)" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Rejilla recesiva: solo horizontales. Las verticales compiten con
                las propias series y no ayudan a leer un monto. */}
            <CartesianGrid vertical={false} stroke="var(--color-sutil)" />

            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-tenue)', fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: 'var(--color-tenue)', fontSize: 11 }}
              tickFormatter={pesosCortos}
            />

            <Tooltip
              /*
                Recharts tipa el valor como `ValueType | undefined` —el tooltip
                puede dispararse sobre un punto sin dato—, así que no se puede
                recibir como `number` a secas. Se normaliza aquí en vez de
                castear: un `as number` sobre un `undefined` haría que
                `formatearMonto` escriba «$NaN» en la pantalla.
              */
              formatter={(valor, nombre) => [
                typeof valor === 'number' ? pesos(valor) : '—',
                String(nombre),
              ]}
              contentStyle={{
                background: 'var(--color-elevada)',
                border: '1px solid var(--color-sutil)',
                borderRadius: 8,
                fontSize: 13,
              }}
              labelStyle={{ color: 'var(--color-principal)', fontWeight: 600 }}
              /* El cursor es una línea y no un bloque: el bloque tapa el punto
                 que se está mirando, que es justo el dato que se vino a ver. */
              cursor={{ stroke: 'var(--color-fuerte)', strokeWidth: 1 }}
            />

            {/*
              Dos series y no más: medido con el validador, la marca de Aquazaku
              solo da DOS cupos categóricos. El azul y el verde están a ΔE 19,6
              en visión plena y 18,5 en deuteranopía; meter el acento como
              tercera serie lo dejaría a ΔE 7,8 del verde.
            */}
            <Area
              type="monotone"
              dataKey="cobrado"
              name="Cobrado"
              stroke="var(--color-exito)"
              strokeWidth={2}
              fill="url(#aq-cobrado)"
            />
            <Area
              type="monotone"
              dataKey="vendido"
              name="Vendido"
              stroke="var(--color-accion)"
              strokeWidth={2}
              fill="url(#aq-vendido)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
