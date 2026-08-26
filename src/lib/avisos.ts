'use client'

import { sileo } from 'sileo'

/**
 * Los avisos temporales del sistema.
 *
 * ── Qué va en un toast y qué NO ─────────────────────────────────────────────
 *
 * Un toast **se va solo**, así que solo sirve para lo que no hace falta volver a
 * leer: «entrada registrada», «roles guardados». Confirmaciones.
 *
 * Lo que NO va acá:
 *
 * - **Los errores de formulario.** Quedan junto al campo, con `<FormError>`: un
 *   error que desaparece obliga a recordar qué decía mientras se corrige.
 * - **La contraseña temporal** de `/modulos/usuarios/[id]`. Se muestra UNA vez y
 *   tiene que quedarse en pantalla hasta que la persona la dicte.
 * - **Los avisos de estado** —«2 productos sin unidades»—, que describen una
 *   situación que sigue siendo cierta después de cerrarlos.
 *
 * ── Por qué envuelve a `sileo` en vez de llamarla directo ───────────────────
 *
 * Para que la decisión de qué librería usar viva en un archivo. Cambiarla
 * después es tocar acá; con llamadas dispersas en doce formularios, es tocar
 * doce.
 *
 * Y para que la duración sea una del sistema y no de cada pantalla: una
 * confirmación que dura lo que cada quien decidió es la misma clase de deriva
 * que tenían los botones antes de `.aq-boton`.
 */

/**
 * Cuánto dura una confirmación.
 *
 * Suficiente para leer una línea sin apurarse, y no tanto como para que se
 * acumulen si alguien registra tres movimientos seguidos.
 */
const DURACION = 4000

/** Una acción que salió bien y no hace falta volver a leer. */
export function avisarExito(titulo: string, detalle?: string): void {
  sileo.success({
    title: titulo,
    ...(detalle && { description: detalle }),
    duration: DURACION,
  })
}

/**
 * Algo que la persona tiene que saber pero que no rompió nada.
 *
 * Por ejemplo: el saldo quedó bajo el mínimo después de un descarte. La
 * operación salió bien; el aviso es sobre lo que viene.
 */
export function avisarAtencion(titulo: string, detalle?: string): void {
  sileo.warning({
    title: titulo,
    ...(detalle && { description: detalle }),
    duration: DURACION,
  })
}
