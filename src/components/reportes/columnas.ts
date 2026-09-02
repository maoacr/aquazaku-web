import type { MovimientoDePlata, TipoDeMovimientoDePlata } from '@/lib/api-types'

/**
 * Las columnas del extracto, declaradas UNA vez — RN-CON-08.
 *
 * ── Por qué una lista y no cinco `<td>` escritos a mano ─────────────────────
 *
 * Las mismas columnas las consumen tres cosas: la tabla en pantalla, el CSV que
 * se descarga y la lista de casillas para elegir cuáles se llevan.
 *
 * Escritas tres veces, elegir «sin medio de pago» ocultaría la columna en
 * pantalla y la seguiría exportando — o al revés, que es peor: el contador
 * abriría un archivo con una columna que no pidió y otra que sí, sin manera de
 * saber cuál de las dos vistas está mal.
 *
 * Declararlas acá hace que la selección de columnas sea leer una lista, no
 * mantener tres sincronizadas.
 */

export interface Columna {
  clave: string
  etiqueta: string
  /** Lo que se lee de la fila. En CSV va tal cual; en pantalla se decora. */
  valor: (m: MovimientoDePlata) => string
  /** Los montos se alinean a la derecha, y así se pueden comparar de un vistazo. */
  numerica?: boolean
}

/** Nombrados por lo que SON para quien lee, no por su valor en la base. */
export const NOMBRE: Record<TipoDeMovimientoDePlata, string> = {
  venta: 'Venta',
  recargo: 'Recargo por daño',
  cobro: 'Cobro',
  devolucion: 'Devolución',
  compra: 'Compra',
}

export const COLUMNAS: Columna[] = [
  { clave: 'fecha', etiqueta: 'Fecha', valor: (m) => m.fecha },
  { clave: 'tipo', etiqueta: 'Movimiento', valor: (m) => NOMBRE[m.tipo] },
  /*
   * La venta de mostrador sin cliente NO es un dato que falte: `cliente_id` es
   * nullable a propósito. El guion lo dice sin sugerir que alguien se olvidó de
   * cargarlo.
   */
  { clave: 'contraparte', etiqueta: 'Con quién', valor: (m) => m.contraparte ?? '—' },
  { clave: 'medioDePago', etiqueta: 'Medio', valor: (m) => m.medioDePago ?? '—' },
  { clave: 'detalle', etiqueta: 'Detalle', valor: (m) => m.detalle ?? '' },
  {
    clave: 'monto',
    etiqueta: 'Monto',
    /*
     * El signo va PEGADO al monto y no en una columna aparte. Separarlos deja
     * que una hoja de cálculo sume una columna de números que son todos
     * positivos — y el total daría la plata movida, no la ganada.
     */
    valor: (m) => `${m.signo === 1 ? '' : '-'}${m.monto}`,
    numerica: true,
  },
  { clave: 'documentoId', etiqueta: 'Documento', valor: (m) => m.documentoId },
]

/**
 * Las que se muestran si nadie eligió.
 *
 * `detalle` y `documentoId` quedan afuera: sirven cuando un número no cuadra y
 * hay que rastrearlo, no para leer el mes. Están a un clic.
 */
export const POR_DEFECTO = ['fecha', 'tipo', 'contraparte', 'medioDePago', 'monto']

/**
 * Qué columnas mostrar, a partir de lo que venga en la URL.
 *
 * Una selección vacía devuelve las de siempre en vez de una tabla sin columnas:
 * el resultado de destildar todo debe ser recuperable sin recargar a mano.
 *
 * **El monto nunca se va.** Un extracto sin montos no es un extracto más
 * corto — es una lista de fechas que se ve como un reporte financiero y no
 * dice nada. Que la única columna irrenunciable esté acá y no en la UI es lo
 * que hace que el CSV tampoco pueda salir sin ella.
 */
export function columnasVisibles(elegidas: string | undefined): Columna[] {
  const claves = new Set(elegidas ? elegidas.split(',').filter(Boolean) : POR_DEFECTO)
  if (claves.size === 0) POR_DEFECTO.forEach((c) => claves.add(c))
  claves.add('monto')

  return COLUMNAS.filter((c) => claves.has(c.clave))
}
