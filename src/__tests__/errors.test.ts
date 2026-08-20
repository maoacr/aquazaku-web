import { describe, expect, it } from 'vitest'
import { ApiError, statusDesdeDigest } from '@/lib/errors'

describe('ApiError', () => {
  it('expone status y body para que la UI decida qué mostrar', () => {
    const error = new ApiError(403, 'sin permiso')

    expect(error.status).toBe(403)
    expect(error.body).toBe('sin permiso')
  })

  it('es un Error de verdad, atrapable con instanceof', () => {
    const error = new ApiError(500, 'boom')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.name).toBe('ApiError')
  })

  it('incluye path y requestId cuando se le pasan', () => {
    const error = new ApiError(500, 'boom', { path: '/usuarios', requestId: 'req-42' })

    expect(error.path).toBe('/usuarios')
    expect(error.requestId).toBe('req-42')
    expect(error.message).toContain('/usuarios')
  })

  // El contexto es opcional: un ApiError construido a mano en un test o en un
  // Server Action no debería romper ni ensuciar el mensaje con un "en undefined".
  it('funciona sin contexto y no ensucia el mensaje', () => {
    const error = new ApiError(404, 'no existe')

    expect(error.path).toBeUndefined()
    expect(error.requestId).toBeUndefined()
    expect(error.message).toBe('API error 404: no existe')
  })
})

describe('digest, que es lo único que llega al browser', () => {
  it('ApiError lo lleva con su status', () => {
    expect(new ApiError(403, 'sin permiso').digest).toBe('aquazaku-api:403')
  })

  it('se puede recuperar el status desde el digest', () => {
    expect(statusDesdeDigest('aquazaku-api:403')).toBe(403)
    expect(statusDesdeDigest('aquazaku-api:500')).toBe(500)
  })

  it('ignora digests que no son nuestros', () => {
    // Next genera sus propios digests; confundirlos con un status daría una
    // pantalla equivocada.
    expect(statusDesdeDigest('1234567890')).toBeNull()
    expect(statusDesdeDigest(undefined)).toBeNull()
  })

  it('sobrevive el ida y vuelta: es lo que hace posible distinguir un 403', () => {
    const error = new ApiError(403, 'sin permiso', { path: '/users' })

    // En producción Next borra message y stack, y conserva solo el digest.
    expect(statusDesdeDigest(error.digest)).toBe(403)
  })
})
