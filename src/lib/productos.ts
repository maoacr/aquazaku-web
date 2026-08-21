import type { Producto } from './api-types'

/**
 * Qué se puede vender, y por qué no.
 *
 * La pregunta que importa NO es "¿le falta el precio?" sino "¿se puede
 * vender?". Un producto con precio cargado pero desactivado tampoco se vende, y
 * ese caso es el más fácil de pasar por alto: el aviso de "falta precio" ya se
 * apagó y solo queda una etiqueta gris.
 *
 * Salió de verificar el flujo real con la suite en verde — ver las notas de T7
 * en el plan de M1.
 */

export interface Vendibilidad {
  noVendibles: Producto[]
  esperandoPrecio: Producto[]
  soloFaltaActivar: number
}

export function analizarVendibilidad(productos: Producto[]): Vendibilidad {
  const noVendibles = productos.filter((p) => !p.activo)
  const esperandoPrecio = noVendibles.filter((p) => Number(p.precioResidencial) === 0)

  return {
    noVendibles,
    esperandoPrecio,
    soloFaltaActivar: noVendibles.length - esperandoPrecio.length,
  }
}

/**
 * Un solo mensaje cuando hay un solo motivo.
 *
 * La primera versión mostraba siempre resumen + desglose, y con un único
 * producto quedaba diciendo lo mismo dos veces seguidas:
 *
 *     1 producto no se puede vender todavía.
 *     1 ya tiene precio cargado: solo falta activarlo.
 *
 * Dos líneas que dicen lo mismo hacen buscar una diferencia que no existe. El
 * desglose se gana su lugar solo cuando conviven los dos motivos.
 */
export function avisoDeNoVendibles(total: number, esperandoPrecio: number): string {
  const plural = total > 1
  const sujeto = plural ? `${total} productos` : '1 producto'

  if (esperandoPrecio === total) {
    return `${sujeto} ${plural ? 'están esperando' : 'está esperando'} su precio y ${
      plural ? 'no se pueden' : 'no se puede'
    } vender todavía.`
  }

  if (esperandoPrecio === 0) {
    return `${sujeto} ya ${plural ? 'tienen' : 'tiene'} precio cargado: solo falta activar${
      plural ? 'los' : 'lo'
    } para poder vender${plural ? 'los' : 'lo'}.`
  }

  return `${sujeto} ${plural ? 'no se pueden' : 'no se puede'} vender todavía.`
}

/** El desglose solo suma cuando los dos motivos conviven. */
export function necesitaDesglose(v: Vendibilidad): boolean {
  return v.esperandoPrecio.length > 0 && v.soloFaltaActivar > 0
}
