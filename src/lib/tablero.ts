import type { MovimientoDePlata, TipoDeMovimientoDePlata } from '@/lib/api-types'
import type { DireccionDeCambio } from '@/components/ui/indicador'
import type { Granularidad, PuntoDeLaSerie } from '@/components/graficos/serie-en-el-tiempo'
import { aCentavos, aMonto } from '@/lib/plata'

/**
 * La aritmética del tablero.
 *
 * ── Por qué agrega el BFF y no `api/` ───────────────────────────────────────
 *
 * `/reportes/extracto` devuelve el movimiento SUELTO, y eso es lo correcto:
 * es la materia prima que el contador concilia, y `resumenMensual` ya demostró
 * que agrupar reusando el mismo cálculo evita que dos reportes del mismo
 * negocio dejen de coincidir.
 *
 * El tablero necesita tres agrupaciones distintas de ese mismo material. Pedir
 * tres endpoints —o uno con un parámetro de granularidad— sería tres caminos
 * donde hoy hay uno, y el día que cambie qué cuenta como venta habría que
 * acordarse de los tres. Aquí se agrupa una vez, en funciones puras que se
 * prueban solas.
 *
 * Una planta de este tamaño mueve cientos de movimientos al mes. El volumen lo
 * permite; si algún día no lo permitiera, la salida es un endpoint que agregue
 * en SQL, no partir esta lógica en dos.
 */

/** Qué tipo del extracto alimenta cada serie. Lo demás no es ninguna de las dos. */
const VENDIDO: TipoDeMovimientoDePlata[] = ['venta', 'recargo']
const COBRADO: TipoDeMovimientoDePlata[] = ['cobro']

export interface RangoDelTablero {
  desde: string
  hasta: string
}

/**
 * Agrupa los movimientos en cubetas del tamaño pedido.
 *
 * ── Toda cubeta del rango existe, aunque esté en cero ───────────────────────
 *
 * Una ausente se lee como «no lo consulté»; una en cero dice «no pasó nada»,
 * que es un dato — y en una planta que factura todos los días, un cero es una
 * alarma. Mismo criterio que `resumenMensual` en `api/`.
 *
 * ── Y se suma en CENTAVOS ───────────────────────────────────────────────────
 *
 * `0.1 + 0.2` da `0.30000000000000004`. Con treinta movimientos, el total del
 * tablero deja de coincidir con el del extracto, y dos reportes del mismo
 * negocio que no coinciden obligan a desconfiar de los dos.
 */
export function cubetas(
  movimientos: MovimientoDePlata[],
  { desde, hasta, granularidad }: RangoDelTablero & { granularidad: Granularidad },
): PuntoDeLaSerie[] {
  const llaves = llavesDelRango(desde, hasta, granularidad)

  // Se arranca con TODAS las cubetas en cero: así ninguna falta y el orden es
  // el del calendario, no el de llegada de los movimientos.
  const acumulado = new Map<string, { vendido: number; cobrado: number }>(
    llaves.map((l) => [l.llave, { vendido: 0, cobrado: 0 }]),
  )

  for (const m of movimientos) {
    const serie = VENDIDO.includes(m.tipo) ? 'vendido' : COBRADO.includes(m.tipo) ? 'cobrado' : null
    if (!serie) continue

    const cubeta = acumulado.get(llaveDe(m.fecha, granularidad))
    // Un movimiento fuera del rango no se fuerza adentro: si llegara uno, es
    // que `api/` devolvió algo que no se pidió, y meterlo en el borde lo
    // escondería.
    if (!cubeta) continue

    cubeta[serie] += aCentavos(m.monto)
  }

  return llaves.map(({ llave, etiqueta }) => {
    const c = acumulado.get(llave)!

    return { etiqueta, vendido: c.vendido / 100, cobrado: c.cobrado / 100 }
  })
}

/** Lo vendido y lo cobrado en el período, como montos string. */
export function totalesDelPeriodo(movimientos: MovimientoDePlata[]): {
  vendido: string
  cobrado: string
} {
  let vendido = 0
  let cobrado = 0

  for (const m of movimientos) {
    if (VENDIDO.includes(m.tipo)) vendido += aCentavos(m.monto)
    else if (COBRADO.includes(m.tipo)) cobrado += aCentavos(m.monto)
  }

  return { vendido: aMonto(vendido), cobrado: aMonto(cobrado) }
}

/**
 * La ventana previa del MISMO largo, pegada al `desde`.
 *
 * Treinta días contra treinta días. Comparar contra el mes calendario anterior
 * daría meses de 28 y de 31 días, y la variación mentiría por el largo de la
 * ventana en vez de decir algo del negocio.
 */
export function periodoAnterior({ desde, hasta }: RangoDelTablero): RangoDelTablero {
  const dias = diasEntre(desde, hasta) + 1

  return { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) }
}

/**
 * Cuánto cambió, con su dirección.
 *
 * ── Contra cero no se inventa un porcentaje ─────────────────────────────────
 *
 * Si el período anterior fue cero, cualquier porcentaje es una división por
 * cero. «+∞ %» y «+100 %» son dos formas distintas de inventar un número. Se
 * dice lo que pasó: no hay con qué comparar.
 */
export function variacion(
  actual: string,
  anterior: string,
): { texto: string; direccion: DireccionDeCambio } {
  const a = aCentavos(actual)
  const b = aCentavos(anterior)

  if (b === 0) return { texto: 'sin base previa', direccion: 'igual' }

  const pct = ((a - b) / b) * 100
  const redondeado = Math.round(pct * 10) / 10

  if (redondeado === 0) return { texto: '0,0 %', direccion: 'igual' }

  const signo = redondeado > 0 ? '+' : '−'
  const texto = `${signo}${Math.abs(redondeado).toFixed(1).replace('.', ',')} %`

  return { texto, direccion: redondeado > 0 ? 'sube' : 'baja' }
}

/* ── Calendario ───────────────────────────────────────────────────────────── */

/*
 * Todas estas cuentas son de CALENDARIO y se hacen en UTC a propósito.
 *
 * Las fechas ya vienen como `AAAA-MM-DD` desde `api/`, que las cortó en la zona
 * de la planta. Una vez que son texto, no tienen hora ni zona: construir con
 * `Date.UTC` y leer con `toISOString` mantiene esa propiedad. Usar
 * `new Date(iso)` y `getDate()` mezclaría la zona del proceso y correría un día
 * en medio planeta — el bug que `hora-de-la-planta.ts` existe para evitar.
 */

function aUtc(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number]

  return Date.UTC(a, m - 1, d)
}

function deUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function sumarDias(iso: string, dias: number): string {
  return deUtc(aUtc(iso) + dias * 86_400_000)
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000)
}

/** El lunes de la semana de una fecha. ISO: la semana empieza el lunes. */
function lunesDe(iso: string): string {
  const dia = new Date(aUtc(iso)).getUTCDay() // 0 = domingo
  const alLunes = dia === 0 ? -6 : 1 - dia

  return sumarDias(iso, alLunes)
}

/** La llave de la cubeta a la que pertenece una fecha. */
function llaveDe(iso: string, granularidad: Granularidad): string {
  if (granularidad === 'dia') return iso
  if (granularidad === 'semana') return lunesDe(iso)

  return iso.slice(0, 7)
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `2026-09-04` → `4 sep`. Para el eje, donde el año es ruido. */
function diaCorto(iso: string): string {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number]

  return `${d} ${MES_CORTO[m - 1]}`
}

/**
 * Las llaves de todas las cubetas del rango, en orden de calendario, con su
 * etiqueta para el eje.
 */
function llavesDelRango(
  desde: string,
  hasta: string,
  granularidad: Granularidad,
): { llave: string; etiqueta: string }[] {
  const salida: { llave: string; etiqueta: string }[] = []

  if (granularidad === 'mes') {
    let [anio, mes] = [Number(desde.slice(0, 4)), Number(desde.slice(5, 7))]
    const fin = hasta.slice(0, 7)

    while (`${anio}-${String(mes).padStart(2, '0')}` <= fin) {
      const llave = `${anio}-${String(mes).padStart(2, '0')}`
      // El año solo cuando el rango lo cruza: en un año solo es ruido.
      salida.push({
        llave,
        etiqueta: desde.slice(0, 4) === hasta.slice(0, 4) ? MESES[mes - 1]! : `${MES_CORTO[mes - 1]} ${anio}`,
      })
      if (mes === 12) {
        anio += 1
        mes = 1
      } else mes += 1
    }

    return salida
  }

  const paso = granularidad === 'semana' ? 7 : 1
  let cursor = granularidad === 'semana' ? lunesDe(desde) : desde

  while (cursor <= hasta) {
    salida.push({
      llave: cursor,
      etiqueta:
        granularidad === 'semana'
          ? // El rango que cubre la cubeta, que se explica solo. «Semana 36» obliga
            // a saber en qué semana del año estamos.
            `${diaCorto(cursor)} – ${diaCorto(sumarDias(cursor, 6))}`
          : diaCorto(cursor),
    })
    cursor = sumarDias(cursor, paso)
  }

  return salida
}
