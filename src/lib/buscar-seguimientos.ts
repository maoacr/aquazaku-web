import type { DireccionALlamar } from '@/lib/api-types'

/**
 * Filtrar la lista de seguimientos por quién es y dónde vive.
 *
 * ── Por qué este filtro vive en el navegador y el de Clientes en `api/` ─────
 *
 * No es una excepción al criterio: es que la pregunta es otra.
 *
 * Clientes busca en el PADRÓN —miles de filas que no están acá—, así que la
 * pregunta viaja a la base. Esta lista ya llegó entera: `clientesALlamar` no
 * tiene `LIMIT` y la pantalla la trae completa para pintar los conteos de las
 * dos pestañas. Preguntarle a `api/` sería un viaje para filtrar algo que ya
 * está en memoria — y peor: `buscarClientesAncho` busca en TODOS los clientes,
 * así que devolvería gente que no está en seguimientos.
 *
 * ── El defecto que esto NO repite ───────────────────────────────────────────
 *
 * El filtro de Clientes vivía acá y hacía `toLowerCase()` sin tocar los
 * acentos. Medido sobre datos reales: «gomez» NO encontraba a «Rosa Elena
 * Padilla Gómez», y «panaderia» NO encontraba a «Panadería del Centro». En
 * Colombia eso es la mitad de los apellidos, y nadie los teclea con tilde. Por
 * eso ese caso es el primer test de `buscar-seguimientos.test.ts`.
 */

/**
 * Las vocales acentuadas y la eñe, que es lo que aparece en un nombre acá.
 *
 * Es el MISMO mapa que `sinAcentos` en `api/src/modules/clientes/service.ts`, y
 * está duplicado a conciencia: allá es SQL —`translate()` sobre una columna— y
 * acá es JavaScript sobre un arreglo que ya está en el navegador. No hay forma
 * de compartir una sola copia entre un `WHERE` y un `filter`.
 *
 * Lo que sí se comparte es el CRITERIO, y por eso un test lo fija carácter por
 * carácter: si alguien agrega la «ç» allá, este archivo tiene que enterarse.
 */
const CON_TILDE = 'áéíóúüñÁÉÍÓÚÜÑ'
const SIN_TILDE = 'aeiouunAEIOUUN'

/**
 * El mismo texto visto sin acentos ni mayúsculas.
 *
 * La eñe entra al mapa: quien busca «munoz» tiene que encontrar a «Muñoz». Es
 * una tecla que no está en todos los teclados y que nadie usa con apuro.
 */
export function sinTildes(texto: string): string {
  return texto.replaceAll(/[áéíóúüñÁÉÍÓÚÜÑ]/g, (c) => SIN_TILDE[CON_TILDE.indexOf(c)]!).toLowerCase()
}

/**
 * Cuántos dígitos hacen falta para que el término se cotee contra el documento.
 *
 * El mismo umbral que `buscarClientes` en `api/`, y por el mismo motivo: con
 * uno o dos, «contiene» arrastra casi todo el padrón. Un «9» suelto está en
 * nueve de cada diez cédulas.
 */
const MINIMO_DIGITOS = 3

/**
 * Las filas que coinciden, en su orden original.
 *
 * El orden lo decidió `api/` —por días sin recibir, con el nombre y la etiqueta
 * desempatando para que la lista no BAILE— y filtrar no lo toca. Reordenar por
 * «relevancia» acá rompería la única cosa que hace recorrible esta pantalla:
 * que lo urgente está arriba.
 */
export function filtrarSeguimientos(
  filas: DireccionALlamar[],
  termino: string,
): DireccionALlamar[] {
  const limpio = termino.trim()
  if (limpio === '') return filas

  const buscado = sinTildes(limpio)

  /*
   * El documento se cotea con los DÍGITOS del término, no con el término.
   *
   * Una cédula se dicta con puntos —«79.123.456»— y se guarda sin ellos, así
   * que compararlos tal cual no encontraría nunca a nadie.
   *
   * Y la guarda es la mitad que importa: sin ella, un término sin dígitos deja
   * el patrón vacío, y «contiene la cadena vacía» es verdadero para TODA fila.
   * El filtro devolvería la lista completa justo cuando alguien busca por
   * nombre, que es el caso más común. Ese defecto ya pasó en `api/` y lo
   * encontró un test que pedía un resultado y recibía dos.
   */
  const digitos = limpio.replaceAll(/\D/g, '')
  const porDocumento = digitos.length >= MINIMO_DIGITOS ? digitos : null

  return filas.filter((fila) => {
    /* `nombre` es la columna generada: ya trae nombres y apellidos — ADR-0006. */
    if (sinTildes(fila.nombre).includes(buscado)) return true
    /* El apodo es como se la conoce en el pueblo — RN-CLI-17. */
    if (fila.apodo !== null && sinTildes(fila.apodo).includes(buscado)) return true
    /* La fila es una PUERTA: «el local» y la calle son parte de su identidad. */
    if (fila.etiqueta !== null && sinTildes(fila.etiqueta).includes(buscado)) return true
    if (fila.direccion !== null && sinTildes(fila.direccion).includes(buscado)) return true
    if (porDocumento !== null && fila.documento !== null) {
      return fila.documento.includes(porDocumento)
    }

    return false
  })
}
