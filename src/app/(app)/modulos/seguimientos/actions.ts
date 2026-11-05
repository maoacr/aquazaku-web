'use server'

import { revalidatePath } from 'next/cache'
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

/**
 * La clave de una fila de seguimientos: cliente, dirección —o su ausencia— y
 * canal. Las tres, porque las tres identifican la fila.
 */
export interface FilaDeSeguimiento {
  clienteId: string
  direccionId: string | null
  canal: 'botellones' | 'otros'
}

/**
 * Sacar una fila de la lista, a mano — RN-CLI-18.
 *
 * ── Qué NO hace ─────────────────────────────────────────────────────────────
 *
 * No borra al cliente, no lo desactiva y no le toca un dato. Solo deja de
 * mostrar esa fila en esa lista, y una venta nueva la devuelve sola: el
 * ocultamiento se guarda con fecha y pierde efecto cuando el cliente vuelve a
 * comprar. El argumento completo está en la migración 0029.
 *
 * ── Por qué revalida las DOS cosas ──────────────────────────────────────────
 *
 * La fila desaparece de la tabla y el conteo de la pestaña baja en uno. Los dos
 * salen de la misma petición, así que alcanza revalidar la ruta — pero hay que
 * hacerlo: sin esto la fila se va y el número de arriba se queda, y entonces la
 * cabecera y la lista dicen cosas distintas sobre el mismo canal.
 */
export async function ocultarDeSeguimientosAction(fila: FilaDeSeguimiento): Promise<void> {
  await apiServerFetch('/clientes/a-llamar/ocultar', {
    method: 'POST',
    body: JSON.stringify(fila),
    headers: { 'Content-Type': 'application/json' },
  })

  revalidatePath('/modulos/seguimientos')
}

/**
 * Devolverla a la lista sin esperar una venta.
 *
 * Es la mitad que convierte la X en una acción y no en una trampa: sin esto,
 * un clic por error esconde a un cliente hasta su próxima compra —pueden ser
 * semanas— y nadie lo va a llamar en el medio.
 */
export async function mostrarEnSeguimientosAction(fila: FilaDeSeguimiento): Promise<void> {
  await apiServerFetch('/clientes/a-llamar/ocultar', {
    method: 'DELETE',
    body: JSON.stringify(fila),
    headers: { 'Content-Type': 'application/json' },
  })

  revalidatePath('/modulos/seguimientos')
}
