import type { Role } from './roles'

/**
 * Formas que devuelve `api/`.
 *
 * Se declaran una sola vez y acá: si cada página redeclarara las suyas, el día
 * que `api/` agregue un campo habría que buscarlo en varios archivos, y el día
 * que lo renombre nadie se enteraría hasta ver la pantalla vacía.
 *
 * Verificadas contra `api/src/modules/users/service.ts`,
 * `api/src/modules/audit/query.ts` y `api/src/db/schema.ts`.
 */

/** `GET /users` y `GET /users/:id`. */
export interface UsuarioListado {
  id: string
  email: string
  name: string
  status: 'active' | 'inactive'
  mustChangePassword: boolean
  roles: Role[]
  createdAt: string
}

/** Una fila de `GET /audit`. */
export interface RegistroDeAuditoria {
  id: number
  userId: string | null
  /**
   * Nombre resuelto por `api/` con un LEFT JOIN.
   *
   * `null` significa que la cuenta se borró y el registro sobrevivió —
   * `audit_log` no tiene FK a `users` justamente para eso. La pantalla lo
   * muestra como "(cuenta eliminada)", no como un espacio en blanco.
   */
  userName: string | null
  userEmail: string | null
  rolEjercido: string[] | null
  action: string
  resource: string | null
  resourceId: string | null
  result: 'ok' | 'denied'
  requestId: string | null
  ip: string | null
  userAgent: string | null
  payload: unknown
  createdAt: string
}

/** `GET /audit`. */
export interface PaginaDeAuditoria {
  filas: RegistroDeAuditoria[]
  /** `null` significa que no hay más: el botón "cargar más" se oculta. */
  siguienteCursor: number | null
}

/**
 * Una fila de `GET /productos` — M1.
 *
 * Los montos y `litros` llegan como **string**: la columna es `numeric` y
 * Drizzle la serializa así. Pasarlos por un float del lenguaje es exactamente
 * donde se pierde el peso que después no cuadra en el cierre, así que se
 * muestran y se reenvían tal cual, sin convertir.
 */
export interface Producto {
  id: string
  /** Generado por api/ — RN-CAT-11. La identidad es el `id`, no esto. */
  codigo: string
  nombre: string
  presentacion: 'paca' | 'botellon'
  contenidoMl: number
  unidades: number
  /** Derivado en la base desde contenido × unidades. Nunca se escribe. */
  litros: string
  precioResidencial: string
  precioComercial: string
  /** Piso absoluto: ningún descuento lo perfora (RN-CAT-04). */
  precioMinimo: string
  precioIncluyeImpuestos: boolean
  tarifaIvaPorcentaje: string
  activo: boolean
  createdAt: string
  updatedAt: string
}

/** Una fila de `GET /stock` — M2. Las tres cifras salen de la misma consulta. */
export interface ResumenDeStock {
  productoId: string
  codigo: string
  nombre: string
  activo: boolean
  total: number
  /** Lo que se puede vender hoy: excluye lo vencido. */
  vendible: number
  /**
   * Vencido con saldo. **No es lo mismo que descartado**: el producto sigue
   * físicamente en la bodega ocupando lugar, y descartarlo es un acto de
   * alguien, no una consecuencia del calendario.
   */
  vencido: number
}

/** Un lote con saldo — `GET /stock/:productoId/lotes`, en orden FIFO. */
export interface LoteConSaldo {
  id: string
  codigo: string
  saldo: number
  fechaEmpaque: string
  fechaVencimiento: string
}

export type TipoDeMovimiento = 'produccion' | 'ajuste' | 'descarte' | 'venta' | 'devolucion'
export type CausaDeDescarte = 'falla_produccion' | 'mal_manejo_cliente' | 'vencido' | 'otro'

/** Una fila del libro — `GET /stock/movimientos`. */
export interface MovimientoDeStock {
  id: number
  loteId: string
  loteCodigo: string
  productoCodigo: string
  /** Positivo entra, negativo sale. Nunca cero. */
  cantidad: number
  tipo: TipoDeMovimiento
  motivo: string | null
  causa: CausaDeDescarte | null
  documentoId: string | null
  registradoPor: string | null
  /** `null` significa que la cuenta se borró y el movimiento sobrevivió. */
  registradoPorNombre: string | null
  createdAt: string
}

export interface PaginaDeMovimientos {
  filas: MovimientoDeStock[]
  siguienteCursor: number | null
}

/**
 * Un insumo de empaque — M3.
 *
 * `saldo` está SIEMPRE en unidades, aunque las bolsas se compren por kilo
 * (RN-INS-02). `equivalenciaPorKilo` en `null` no es un dato faltante por
 * descuido: es la medición de planta que todavía no se hizo, y mientras siga
 * así la entrada por kilos se rechaza en vez de estimar.
 */
export interface InsumoListado {
  id: string
  codigo: string
  nombre: string
  unidad: 'unidad'
  minimo: number
  saldo: number
  /** Unidades por kilo. `null` hasta medirlo — pregunta 37. */
  equivalenciaPorKilo: string | null
  activo: boolean
  /** Resuelto por `api/`: la pantalla no repite la comparación. */
  bajoMinimo: boolean
}

export interface MovimientoDeInsumo {
  id: number
  insumoId: string
  cantidad: number
  tipo: 'compra' | 'ajuste' | 'descarte' | 'produccion'
  motivo: string | null
  causa: string | null
  /** Los dos juntos o los dos nulos: es lo que hace auditable la conversión. */
  kilos: string | null
  equivalencia: string | null
  registradoPor: string | null
  createdAt: string
}

/* ── Producción y agua — M4 ─────────────────────────────────────────────── */

/**
 * Un cierre del día — `GET /produccion`.
 *
 * No se edita ni se borra (RN-PRD-08): mueve el agua, el stock y los insumos
 * de una vez, y cambiarlo después dejaría los tres saldos sin explicación. Una
 * corrección es un ajuste posterior, con motivo y responsable.
 *
 * `caudalGpm` y `litrosProcesados` van juntos o van los dos en `null`: sin
 * caudal medido no hay litros procesados que calcular, y la base lo obliga con
 * un CHECK. Un cierre sin ellos sigue siendo válido — el envasado se sabe
 * aunque el procesamiento no.
 */
export interface CierreDeProduccion {
  id: string
  /** `YYYY-MM-DD`. Uno por día — RN-PRD-22. */
  fecha: string
  minutosProcesando: number
  /** `numeric` en la base, así que llega como string. `null` hasta medirlo. */
  caudalGpm: string | null
  litrosProcesados: number | null
  pacas600: number
  pacas300: number
  botellonesLlenados: number
  botellonesLavados: number
  /** Lo que salió del tanque procesado ese día. Guardado, no recalculado. */
  litrosConsumidos: number
  nivelObservado: NivelDeTanque | null
  registradoPor: string | null
  createdAt: string
}

export type Tanque = 'crudo' | 'procesado'

/** Los cinco niveles que el ojo distingue — RN-PRD-11. No hay medidor. */
export type NivelDeTanque = 'vacio' | 'un_cuarto' | 'medio' | 'tres_cuartos' | 'lleno'

/** El saldo de un tanque — `GET /tanques`. */
export interface SaldoDeAgua {
  tanque: Tanque
  /** Lo que dice el libro. **Este manda** — RN-PRD-14. */
  litros: number
  capacidad: number
  /** El nivel al que corresponde ese saldo, para poder compararlo con el ojo. */
  nivelCalculado: NivelDeTanque
}

/**
 * El resultado de comparar el libro contra lo que se vio —
 * `GET /tanques/reconciliacion`. **No escribe nada.**
 */
export interface Reconciliacion {
  tanque: Tanque
  litrosCalculados: number
  nivelCalculado: NivelDeTanque
  nivelObservado: NivelDeTanque
  /** El rango de litros que representa el nivel observado. */
  banda: { nivel: NivelDeTanque; desde: number; hasta: number }
  cuadra: boolean
  /** Litros hasta el CENTRO de la banda. Es una sugerencia, no una corrección. */
  ajusteSugerido: number
}

/**
 * Los números con los que el cierre calcula — `GET /produccion/parametros`.
 *
 * Existen como endpoint para que la vista previa NO copie `3.785` ni `0.7`.
 * Los dos están marcados para cambiar —el galón puede ser imperial (pregunta
 * 4) y el rendimiento es RN-PRD-12, que se revisa cuando se mida de verdad— y
 * una pantalla que promete el número viejo hace que se confirme creyendo otra
 * cosa.
 */
export interface ParametrosDeProduccion {
  litrosPorGalon: number
  /** Fracción utilizable del agua cruda. `0.7` = 70 %. */
  rendimiento: number
  /** Qué se consume por cada botellón envasado, uno de cada uno. */
  insumosPorBotellon: string[]
}

/** Lo que devuelve `POST /produccion/cierres`. */
export interface ResultadoDelCierre {
  cierre: CierreDeProduccion
  /** Un lote por producto envasado — RN-PRD-23. */
  lotes: { codigo: string; productoId: string; cantidad: number }[]
}
