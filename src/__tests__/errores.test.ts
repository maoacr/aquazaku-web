import { describe, expect, it } from 'vitest'
import { TEXTO_DE_ACCION, mensajeDeError } from '@/lib/errores'
import { ApiError } from '@/lib/errors'

/**
 * Los status que `api/` devuelve de verdad.
 *
 * No es la lista de códigos HTTP que existen: es la que sale de leer sus rutas.
 * `400` validación de Zod, `401` sin sesión, `403` sin permiso, `404` no existe,
 * `409` conflicto, `422` regla de negocio, `429` demasiados intentos, `500`
 * falla interna.
 *
 * Si `api/` empieza a devolver otro, este arreglo se actualiza y el test de
 * cobertura falla hasta que alguien escriba el texto. Ese es el punto: **un
 * status sin traducir tiene que romper el build, no caer en un genérico**, que
 * es como se llega a que un usuario lea «error 409».
 */
const STATUS_QUE_DEVUELVE_LA_API = [400, 401, 403, 404, 409, 422, 429, 500]

/** Todo lo que R52 prohíbe que llegue a los ojos de una persona. */
const JERGA = [
  /\b[45]\d{2}\b/, // un código HTTP suelto
  /timeout/i,
  /\bnull\b/i,
  /\bundefined\b/i,
  /\berror\b\s*:/i, // "Error:" de un stack
  /\bstack\b/i,
  /fetch|request|response|payload/i,
  /\b(usuarios|productos|lotes|movimientos|audit_log)\b\s*\./, // nombre de tabla
]

describe('R52 · los errores no tienen jerga', () => {
  for (const status of STATUS_QUE_DEVUELVE_LA_API) {
    describe(`status ${status}`, () => {
      const mensaje = mensajeDeError(new ApiError(status, ''))

      it('tiene título y detalle escritos', () => {
        expect(mensaje.titulo.length).toBeGreaterThan(8)
        expect(mensaje.detalle.length).toBeGreaterThan(12)
      })

      it('no filtra códigos ni jerga técnica', () => {
        const texto = `${mensaje.titulo} ${mensaje.detalle}`

        for (const prohibido of JERGA) {
          expect(texto, `«${texto}» contiene ${prohibido}`).not.toMatch(prohibido)
        }
      })

      it('ofrece exactamente una acción, y con texto', () => {
        expect(TEXTO_DE_ACCION[mensaje.accion]).toBeTruthy()
      })
    })
  }

  /**
   * Este es el que pide el plan: un status sin traducir tiene que romper, no
   * caer en un texto genérico. Sin él, agregar un `418` a `api/` haría que el
   * usuario viera «algo se rompió» para algo que tiene explicación.
   */
  it('todos los status que devuelve api/ están traducidos', () => {
    const sinTraducir = STATUS_QUE_DEVUELVE_LA_API.filter((status) => {
      const propio = mensajeDeError(new ApiError(status, ''))
      const generico = mensajeDeError(new ApiError(500, ''))

      return status !== 500 && propio.titulo === generico.titulo
    })

    expect(sinTraducir, `sin traducir: ${sinTraducir.join(', ')}`).toEqual([])
  })
})

describe('el mensaje del servidor se respeta solo donde está curado', () => {
  /**
   * `api/` manda `{ code, mensaje }` con texto humano para las violaciones de
   * regla. Reemplazarlo por un genérico perdería lo único útil: qué regla frenó
   * la operación.
   */
  it('un 422 muestra la regla que se violó, no un texto genérico', () => {
    const error = new ApiError(
      422,
      JSON.stringify({ code: 'CANTIDAD_INVALIDA', mensaje: 'la cantidad tiene que ser mayor que cero' }),
    )

    expect(mensajeDeError(error).detalle).toBe('la cantidad tiene que ser mayor que cero')
  })

  it('un 409 también', () => {
    const error = new ApiError(409, JSON.stringify({ code: 'X', mensaje: 'ese código ya existe' }))

    expect(mensajeDeError(error).detalle).toBe('ese código ya existe')
  })

  /**
   * Un 500 puede traer un stack y un 400 el nombre de un campo de Zod. Confiar
   * en esos cuerpos sería filtrar exactamente la jerga que R52 prohíbe.
   */
  it('un 500 IGNORA el cuerpo aunque traiga un mensaje', () => {
    const error = new ApiError(500, JSON.stringify({ mensaje: 'null pointer en lotes.saldo' }))

    expect(mensajeDeError(error).detalle).not.toContain('null')
    expect(mensajeDeError(error).detalle).not.toContain('lotes')
  })

  it('un 400 también ignora el cuerpo', () => {
    const error = new ApiError(400, JSON.stringify({ mensaje: 'Expected string, received undefined' }))

    expect(mensajeDeError(error).detalle).not.toMatch(/undefined/i)
  })

  it('un cuerpo que no es JSON no rompe nada', () => {
    expect(() => mensajeDeError(new ApiError(422, '<html>502 Bad Gateway</html>'))).not.toThrow()
    expect(mensajeDeError(new ApiError(422, '<html>502</html>')).detalle).not.toContain('502')
  })
})

describe('R53 · sin conexión', () => {
  /**
   * Lo que se rompe cuando no hay red no es un `ApiError`: es un `TypeError` de
   * `fetch`, o cualquier cosa. Por eso la función acepta `unknown`.
   */
  it('cualquier cosa que no sea un ApiError se trata como falta de conexión', () => {
    for (const cosa of [new TypeError('fetch failed'), 'algo', null, undefined, { raro: true }]) {
      expect(mensajeDeError(cosa).titulo).toBe('No pudimos conectarnos')
    }
  })

  /**
   * Es lo más importante que se le puede decir a quien acaba de perder una venta
   * a medio registrar. Sin esto, la duda —«¿quedó a medias?»— cuesta más que la
   * falla, porque obliga a ir a revisar.
   */
  it('aclara que no se perdió nada y que se puede reintentar', () => {
    const mensaje = mensajeDeError(new TypeError('fetch failed'))

    expect(mensaje.detalle).toMatch(/no se perdió nada/i)
    expect(mensaje.seEjecuto).toBe(false)
  })

  it('no dice «error de red» ni «timeout»', () => {
    const texto = Object.values(mensajeDeError(new TypeError('network timeout'))).join(' ')

    expect(texto).not.toMatch(/timeout/i)
    expect(texto).not.toMatch(/\bred\b/i)
  })
})
