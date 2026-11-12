import type { TipoDeEgreso, TipoDeIngreso } from './api-types'

/**
 * Los tipos de gasto, como se eligen y como se leen — M17.
 *
 * ── Por qué el orden no es el del enum ──────────────────────────────────────
 *
 * El enum de `api/` está agrupado por naturaleza; este desplegable está ordenado
 * por **cuántas veces al mes se usa**. Lo que se paga todos los meses va arriba:
 * recibos, arriendo, nómina. Un desplegable alfabético obliga a leer catorce
 * opciones para encontrar la que se usa cuatro veces por semana.
 *
 * `otro` va último a propósito: es la salida, no la primera opción.
 */
export const TIPOS_DE_EGRESO: readonly TipoDeEgreso[] = [
  'recibo_publico',
  'arriendo',
  'nomina',
  'transporte',
  'servicio',
  'mantenimiento',
  'repuesto',
  'software',
  'litografia',
  'impuesto',
  'comision_bancaria',
  'equipo',
  'mueble',
  'otro',
] as const

/**
 * Cómo se lee cada tipo en la pantalla.
 *
 * `Record<TipoDeEgreso, string>` y no un objeto suelto: si `api/` agrega un tipo
 * y acá no se le pone etiqueta, **esto no compila**. Es la misma defensa que
 * `NOMBRE` en las columnas de reportes.
 */
export const ETIQUETA_DE_EGRESO: Record<TipoDeEgreso, string> = {
  recibo_publico: 'Recibo público',
  arriendo: 'Arriendo',
  nomina: 'Nómina',
  transporte: 'Transporte',
  servicio: 'Servicio',
  mantenimiento: 'Mantenimiento',
  repuesto: 'Repuesto',
  software: 'Software',
  litografia: 'Litografía',
  impuesto: 'Impuesto',
  comision_bancaria: 'Comisión bancaria',
  equipo: 'Equipo',
  mueble: 'Mueble',
  otro: 'Otro',
}

/** La ayuda de cada tipo, para que nadie tenga que adivinar dónde va un gasto. */
export const AYUDA_DE_EGRESO: Record<TipoDeEgreso, string> = {
  recibo_publico: 'Agua, luz, gas, internet',
  arriendo: 'El local, la bodega',
  nomina: 'Sueldos y quincenas',
  transporte: 'Gasolina, fletes, domicilios',
  servicio: 'Mano de obra, contrataciones, desarrollo',
  mantenimiento: 'De la planta y de los equipos',
  repuesto: 'Piezas de la planta de tratamiento',
  software: 'Hosting, licencias, suscripciones',
  litografia: 'Facturas, stickers, publicidad, banners',
  impuesto: 'Impuestos y declaraciones',
  comision_bancaria: 'Cuota de manejo, 4x1000, costo de transferencia',
  equipo: 'Computadores, teléfonos, impresoras',
  mueble: 'Mesas, estantes, sillas',
  otro: 'Lo que no encaja en ninguno — queda para revisar',
}

/**
 * Los tipos agrupados, como se leen en el desplegable.
 *
 * ── Por qué agrupar y no agregar una columna «categoría» ────────────────────
 *
 * Catorce opciones planas se recorren leyéndolas todas. Agrupadas, el ojo salta
 * al grupo y después elige dentro — tres o cuatro por grupo, que es lo que se
 * compara de un vistazo.
 *
 * La agrupación es **de pantalla**: no viaja a `api/`, no se guarda y no hay una
 * segunda columna que mantener de acuerdo con el tipo. Un grupo mal elegido se
 * corrige editando este archivo; una columna mal llenada hay que migrarla.
 *
 * El orden de los grupos es el de frecuencia, igual que el de `TIPOS_DE_EGRESO`:
 * lo que se paga todos los meses va arriba.
 */
export const GRUPOS_DE_EGRESO: ReadonlyArray<{
  titulo: string
  tipos: readonly TipoDeEgreso[]
}> = [
  { titulo: 'Todos los meses', tipos: ['recibo_publico', 'arriendo', 'nomina'] },
  { titulo: 'La operación', tipos: ['transporte', 'servicio', 'mantenimiento', 'repuesto'] },
  {
    titulo: 'Administración',
    tipos: ['software', 'litografia', 'impuesto', 'comision_bancaria'],
  },
  { titulo: 'Compras y equipo', tipos: ['equipo', 'mueble', 'otro'] },
] as const

export const TIPOS_DE_INGRESO: readonly TipoDeIngreso[] = [
  'recaudo_de_ventas',
  'aporte_socio',
  'prestamo',
  'devolucion_de_proveedor',
  'otro',
] as const

export const ETIQUETA_DE_INGRESO: Record<TipoDeIngreso, string> = {
  recaudo_de_ventas: 'Recaudo de ventas',
  aporte_socio: 'Aporte de socio',
  prestamo: 'Préstamo',
  devolucion_de_proveedor: 'Devolución de proveedor',
  otro: 'Otro',
}

export const ETIQUETA_DE_CUENTA = {
  caja_menor: 'Caja menor',
  caja_mayor: 'Caja mayor',
  banco: 'Banco',
} as const
