import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Un número del negocio, con lo que hace falta para leerlo sin equivocarse.
 *
 * ── Por qué vive en `ui/` y no en el tablero ────────────────────────────────
 *
 * Un total grande con su etiqueta y su comparación no es del tablero: lo
 * necesita cualquier módulo que muestre un número que alguien mira para decidir.
 * Nace compartido para que el segundo que lo precise no lo copie con otro alto
 * de línea y terminemos con dos indicadores que no se parecen.
 *
 * Es un Server Component: no tiene estado ni efectos, así que se pinta en el
 * servidor y llega como HTML.
 *
 * ── La dirección NUNCA se cuenta solo con color ─────────────────────────────
 *
 * Cerca del 8 % de los varones no separa el par verde/rojo, y al sol en la
 * planta no lo separa nadie. Por eso cada comparación lleva **tres** canales:
 * el color, la flecha y la palabra en el nombre accesible. Es la misma regla
 * que ya aplica `Etiqueta` en `tabla.tsx` y los gráficos de `graficos/`.
 */

export type DireccionDeCambio = 'sube' | 'baja' | 'igual'

const FLECHA = { sube: ArrowUp, baja: ArrowDown, igual: ArrowRight } as const

/** La palabra que escucha un lector de pantalla. El color no se la dice. */
const PALABRA: Record<DireccionDeCambio, string> = {
  sube: 'Sube',
  baja: 'Baja',
  igual: 'Sin cambio',
}

/*
 * `sube` usa el verde RESERVADO del sistema y `baja` el rojo. Aquí significan lo
 * que el sistema dice que significan —en orden y en problema— porque en un
 * indicador de negocio una subida de ventas ES lo bueno.
 *
 * Ojo el día que alguien quiera un indicador donde subir sea malo (devoluciones,
 * mermas): ahí el color mentiría. Cuando aparezca ese caso, la salida es un
 * parámetro que separe «dirección» de «si eso es bueno», no pintarlo al revés
 * en la pantalla que lo use.
 */
const TONO: Record<DireccionDeCambio, string> = {
  sube: 'text-exito-texto bg-exito-fondo',
  baja: 'text-error-texto bg-error-fondo',
  igual: 'text-secundario bg-elevada',
}

export function Indicador({
  etiqueta,
  valor,
  nota,
  comparacion,
  anclado,
}: {
  etiqueta: string
  /**
   * Ya formateado. El componente NO formatea: quién decide si un monto va con
   * separador de miles o un conteo va pelado es quien tiene el dato, y
   * formatear aquí obligaría a pasarle también el tipo.
   */
  valor: string
  /** La letra chica debajo de la comparación. */
  nota?: string
  comparacion?: { texto: string; direccion: DireccionDeCambio }
  /**
   * El MOTIVO por el que este número no sigue al filtro de la pantalla.
   *
   * Es el motivo y no un booleano a propósito. En el tablero, «Por recaudar»
   * sale de la cartera, que es una foto de hoy —el endpoint no acepta fechas, y
   * es correcto que no las acepte porque los cobros posteriores ya están
   * imputados—. Al lado de tres números que sí siguen al rango, uno que se
   * queda quieto se lee como un bug.
   *
   * Marcarlo sin decir por qué sería la misma falta que apagar un botón sin
   * explicar: se ve que algo es distinto y no se sabe qué hacer con eso. Con el
   * motivo en el tipo, no se puede marcar sin explicar.
   */
  anclado?: string
}) {
  const Flecha = comparacion ? FLECHA[comparacion.direccion] : null

  return (
    <div
      className={`aq-tarjeta grid gap-0 p-4 ${anclado ? 'outline outline-dashed outline-sutil -outline-offset-1' : ''}`}
      {...(anclado ? { 'data-anclado': '' } : {})}
    >
      <p className="aq-micro text-tenue">{etiqueta}</p>

      {/*
        Tabular, y es funcional, no estético: cuatro indicadores en fila se leen
        barriendo la columna de dígitos. Con una tipografía proporcional el `1`
        es más angosto que el `8` y los montos quedan desalineados, así que hay
        que leerlos de a uno.
      */}
      <p className="aq-cifra mt-2 text-[30px] leading-none font-semibold tracking-tight text-principal">
        {valor}
      </p>

      {comparacion || nota || anclado ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-2">
          {comparacion && Flecha ? (
            <span
              data-direccion={comparacion.direccion}
              /*
                `role="img"` + `aria-label` y no un `sr-only` suelto: un `<span>`
                pelado tiene rol `generic`, que NO admite nombre accesible. Con
                el rol de imagen, el lector anuncia «Sube 14,2 %» una sola vez
                en vez de leer la flecha y el texto por separado.
              */
              role="img"
              aria-label={`${PALABRA[comparacion.direccion]} ${comparacion.texto}`}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold ${TONO[comparacion.direccion]}`}
            >
              <Flecha aria-hidden className="size-3.5 shrink-0" />
              {comparacion.texto}
            </span>
          ) : null}

          {nota ? <span className="text-[12px] text-tenue">{nota}</span> : null}
          {anclado ? <span className="text-[12px] text-tenue">{anclado}</span> : null}
          
        </p>
      ) : null}
    </div>
  )
}

/**
 * La fila de indicadores.
 *
 * ── `minmax(0, 1fr)` y no `1fr` ─────────────────────────────────────────────
 *
 * Tailwind ya genera `minmax(0,1fr)` en sus `grid-cols-*`, así que esto sale
 * gratis usando las clases y NO escribiendo la grilla a mano. Vale dejarlo
 * dicho: una pista `1fr` es `minmax(auto, 1fr)`, y ese mínimo automático no
 * baja del min-content del contenido — el hijo desborda al padre y aparece
 * scroll horizontal a 320 px. Medido en una maqueta que sí tenía la grilla
 * escrita a mano.
 *
 * Uno por fila en teléfono, dos en tablet, cuatro en escritorio.
 */
export function FilaDeIndicadores({ children }: { children: ReactNode }) {
  return <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}
