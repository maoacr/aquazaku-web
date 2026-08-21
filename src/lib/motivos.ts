/**
 * Largo mínimo de un motivo escrito a mano.
 *
 * Espeja `api/src/lib/motivos.ts`. Se repite el número en vez de compartirlo
 * porque los dos repos son independientes y no hay paquete común: el que manda
 * es el de `api/`, y este existe para poder avisar **antes** de mandar el
 * formulario, no para decidir.
 *
 * Convención transversal del proyecto (R2 del sistema de diseño): aplica a
 * anulaciones, devoluciones, daños, ajustes y diferencias de cierre.
 */
export const LARGO_MINIMO_MOTIVO = 10
