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
