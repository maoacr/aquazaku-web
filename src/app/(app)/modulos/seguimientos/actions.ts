'use server'

import { apiServerFetch } from '@/lib/api-server'
import type { VentaDelListado } from '@/lib/api-types'

/**
 * La venta que fijó el reloj de una fila, entera y lista para corregir.
 *
 * ── Por qué se pide al abrir y no con la lista ──────────────────────────────
 *
 * Cuarenta filas traerían cuarenta ventas con sus líneas para que alguien
 * corrija una. Y ésta ya es la pantalla más pesada del módulo: la lista, dos
 * canales y los teléfonos de todos.
 *
 * ── Por qué la venta ENTERA ─────────────────────────────────────────────────
 *
 * Porque lo que se abre es el mostrador de siempre, precargado. Corregir no
 * parchea un campo: reemplaza la venta, así que el formulario necesita todo lo
 * que había —carrito, precios a mano, botellones, fecha del hecho— o lo que no
 * llegue se guardaría cambiado.
 */
export async function ventaParaCorregirAction(ventaId: string): Promise<VentaDelListado> {
  return apiServerFetch<VentaDelListado>(`/ventas/${ventaId}`)
}
