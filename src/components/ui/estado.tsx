import { AlertTriangle, Check, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Un estado del semáforo, dicho por CUATRO canales a la vez (R40).
 *
 * ```
 * dado    cualquier estado del semáforo
 * entonces se muestran simultáneamente color + forma + icono + texto en mayúsculas
 * ```
 *
 * La regla parece redundante hasta que se entiende contra qué protege. Cerca
 * del 8 % de los varones tiene alguna deficiencia de visión del color, y el par
 * verde/rojo es justamente el que más se confunde. Un semáforo que solo cambia
 * de color le dice lo mismo en los tres estados. Y no hace falta llegar al
 * daltonismo: una pantalla al sol en la planta, un teléfono en modo de ahorro de
 * batería o una foto en blanco y negro por WhatsApp borran el color igual.
 *
 * Los cuatro canales son independientes a propósito. Con perder tres, el estado
 * se sigue leyendo.
 *
 * ── Por qué la forma es una marca aparte y no el contenedor ─────────────────
 *
 * `.aq-forma-justo` y `.aq-forma-expuesto` son `clip-path`: recortan el
 * elemento al que se aplican. Puestas en la insignia, se llevarían el texto por
 * delante — un triángulo con letras adentro corta las letras.
 *
 * Así que la forma es un cuadradito de 10 px al principio, pintado con
 * `currentColor` para que siga al tono sin declararlo dos veces.
 *
 * ── Cuándo NO usar esto ─────────────────────────────────────────────────────
 *
 * Esto es el semáforo: tres niveles ordenados de peor a mejor. Para una etiqueta
 * que solo clasifica —activo/inactivo, permitido/denegado— está `Etiqueta` en
 * `tabla.tsx`, que no tiene forma ni icono porque no es un semáforo y agregarle
 * una flecha de alerta a un «inactivo» diría algo que no es.
 */
export function Estado({ tono, children }: { tono: Tono; children: ReactNode }) {
  const { estilo, forma, Icono } = CANALES[tono]

  return (
    <span
      className={`aq-micro inline-flex items-center gap-1.5 rounded px-2 py-0.5 ring-1 ring-inset ${estilo}`}
    >
      {/* Canal 2: la forma. `aria-hidden` — el texto ya lo dice. */}
      <span aria-hidden className={`size-2.5 shrink-0 bg-current ${forma}`} />

      {/* Canal 3: el icono. */}
      <Icono aria-hidden className="size-3.5 shrink-0" />

      {/* Canal 4: el texto. Las mayúsculas las pone `.aq-micro`. */}
      {children}
    </span>
  )
}

/**
 * Los tres niveles, nombrados como el sistema de diseño los nombra.
 *
 * No son `ok`/`warning`/`error`: son grados de **cobertura**. Un lote que vence
 * mañana no es un error —nadie se equivocó— es un estado del que hay que
 * ocuparse antes de que lo sea.
 */
export type Tono = 'cubierto' | 'justo' | 'expuesto'

/**
 * El icono de cada estado, **exportado a propósito**.
 *
 * La regla del sistema es que un concepto no tenga dos iconos. Escribirla en la
 * documentación no alcanza: la tabla de stock ya marcaba las unidades vencidas
 * con un triángulo de alerta mientras la insignia usaba una equis, y nadie lo
 * notó hasta que los dos quedaron en la misma pantalla.
 *
 * Con una sola fuente, divergir deja de ser posible sin darse cuenta: quien
 * quiera otro icono para «vencido» tiene que cambiarlo acá, y ahí se ve que
 * cambia en todos lados.
 */
export const ICONO_DE_ESTADO: Record<Tono, LucideIcon> = {
  cubierto: Check,
  justo: AlertTriangle,
  expuesto: X,
}

const CANALES = {
  cubierto: {
    // Canal 1: el color. El verde RESERVADO, que en este sistema solo
    // significa «todo en orden» — y acá lo significa.
    estilo: 'bg-exito-fondo text-exito-texto ring-exito-borde',
    forma: 'aq-forma-cubierto',
    Icono: ICONO_DE_ESTADO.cubierto,
  },
  justo: {
    estilo: 'bg-alerta-fondo text-alerta-texto ring-alerta-borde',
    forma: 'aq-forma-justo',
    Icono: ICONO_DE_ESTADO.justo,
  },
  expuesto: {
    estilo: 'bg-error-fondo text-error-texto ring-error-borde',
    forma: 'aq-forma-expuesto',
    Icono: ICONO_DE_ESTADO.expuesto,
  },
} as const satisfies Record<Tono, { estilo: string; forma: string; Icono: LucideIcon }>

/**
 * ── El vencimiento de un lote, como estado del semáforo ─────────────────────
 *
 * `RN-STK-08` fija la vida útil en 30 días y bloquea lo vencido. Lo que el
 * dominio **no** define es cuántos días antes conviene avisar, así que este
 * número es una propuesta, no una regla: está la pregunta 36 en `pendientes`
 * esperando que Aquazaku lo confirme.
 *
 * Siete días sobre treinta deja una cuarta parte de la vida para reaccionar, y
 * es un número redondo de decir en la planta: «lo que vence esta semana». Si
 * resulta ser poco o mucho, se cambia esta constante y nada más.
 */
export const DIAS_DE_AVISO_DE_VENCIMIENTO = 7

/**
 * `hoy` llega por parámetro y no de `new Date()` a propósito: el servidor y el
 * browser pueden estar en husos distintos, y un lote no puede vencer en una
 * pantalla y estar vigente en la otra. Quien pinta decide cuál es hoy.
 *
 * Las fechas son `YYYY-MM-DD`, así que comparar como texto ordena igual que
 * comparar como fecha — sin construir un `Date` que arrastre husos.
 */
export function estadoDeVencimiento(fechaVencimiento: string, hoy: string): Tono {
  if (fechaVencimiento < hoy) return 'expuesto'

  return diasEntre(hoy, fechaVencimiento) <= DIAS_DE_AVISO_DE_VENCIMIENTO ? 'justo' : 'cubierto'
}

/** Días de calendario entre dos `YYYY-MM-DD`, contados en UTC para no arrastrar husos. */
function diasEntre(desde: string, hasta: string): number {
  const MS_POR_DIA = 86_400_000

  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA)
}

/** El texto de cada estado de vencimiento. En minúsculas: las pone `.aq-micro`. */
export const TEXTO_DE_VENCIMIENTO: Record<Tono, string> = {
  cubierto: 'vigente',
  justo: 'vence pronto',
  expuesto: 'vencido',
}
