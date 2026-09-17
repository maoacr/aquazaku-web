/**
 * La hora de Aquazaku es la hora de Campo de la Cruz.
 *
 * ── El bug que esto evita ───────────────────────────────────────────────────
 *
 * `toLocaleString('es-CO')` sin `timeZone` usa la zona del PROCESO. En un Server
 * Component ese proceso es el de Node, y el contenedor corre en UTC: el
 * docker-compose no define `TZ` para ningún servicio.
 *
 * | Venta del 31-ago a las 19:30 en la planta | Se muestra |
 * | --- | --- |
 * | Proceso en `America/Bogota` (una Mac) | 31/08/26, 7:30 p. m. ✓ |
 * | Proceso en UTC (el contenedor)        | **1/09/26, 12:30 a. m.** ✗ |
 *
 * Colombia es UTC−5, así que todo lo que pasa después de las 19:00 se muestra
 * con el día siguiente. No es la hora corrida: es la FECHA equivocada, en la
 * lista que alguien mira para saber qué se vendió ayer.
 *
 * Y no falla ruidosamente. Cada venta está en algún lado, los totales cierran, y
 * el descuadre solo aparece cuando alguien compara la pantalla contra lo que
 * recuerda haber cobrado.
 *
 * ── Es el gemelo de `api/src/lib/dia.ts` ────────────────────────────────────
 *
 * Aquel resolvió el mismo bug para las agregaciones SQL —`AT TIME ZONE` antes
 * de `::date`— y lo encontró el CI, no una lectura. Este cubre la capa que
 * quedó: la presentación. Los dos fijan la zona en el CÓDIGO y no en el
 * entorno, por la misma razón que aquel escribió: da lo mismo dónde corra el
 * servidor.
 *
 * ── Por qué NO se pone `TZ` en el docker-compose ───────────────────────────
 *
 * Parece el arreglo obvio —una línea y listo— y es contraproducente. Los
 * entornos corren en UTC a propósito: es lo que hace VISIBLE esta clase de bug.
 * `dia.ts` lo dice de la base con todas las letras —«en desarrollo la base está
 * en America/Bogota y el bug es invisible»— y ese bug lo encontró el CI, que
 * corre en UTC, no una lectura del código.
 *
 * Poner `TZ: America/Bogota` haría pasar en verde el próximo formateo que se
 * olvide de la zona, y el descuadre saldría recién en producción. La zona va
 * acá, una vez, y el entorno se queda en UTC para que el siguiente error se
 * caiga temprano.
 */

/**
 * La zona de la planta. Tiene que decir lo mismo que `ZONA_DE_LA_PLANTA` de
 * `api/`: dos lugares del sistema que discrepen sobre qué día es hoy es
 * exactamente el descuadre que esto viene a evitar.
 */
export const ZONA_DE_LA_PLANTA = 'America/Bogota'

/** Lo que llega de `api/` es un string ISO; lo que se arma acá suele ser un `Date`. */
type Momento = Date | string

function instante(momento: Momento): Date {
  return momento instanceof Date ? momento : new Date(momento)
}

/**
 * Fecha y hora, como se leen en la planta.
 *
 * `dateStyle: 'short'` y no el formato largo: esto va en celdas de tabla, donde
 * una fecha escrita en palabras empuja las columnas que importan fuera de la
 * pantalla.
 */
export function fechaYHoraEnLaPlanta(momento: Momento): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: ZONA_DE_LA_PLANTA,
  }).format(instante(momento))
}

/** Solo el día calendario de la planta. */
export function fechaEnLaPlanta(momento: Momento): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeZone: ZONA_DE_LA_PLANTA,
  }).format(instante(momento))
}

/**
 * Solo la hora.
 *
 * Sin fecha a propósito donde se usa: el sello de un dato que se relee todo el
 * tiempo se mira para saber si es de hace un minuto o de hace una hora.
 */
export function horaEnLaPlanta(momento: Momento): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA_DE_LA_PLANTA,
  }).format(instante(momento))
}
