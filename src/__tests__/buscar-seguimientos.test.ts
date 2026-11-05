import { describe, expect, it } from 'vitest'
import type { DireccionALlamar } from '@/lib/api-types'
import { filtrarSeguimientos, sinTildes } from '@/lib/buscar-seguimientos'

/**
 * El filtro de la lista de seguimientos.
 *
 * ── Por qué este filtro vive acá y el de Clientes en `api/` ─────────────────
 *
 * La pantalla de Clientes busca en el PADRÓN: miles de filas que no están en el
 * navegador, así que la pregunta viaja a la base. Esta lista ya llegó entera
 * —`clientesALlamar` no tiene `LIMIT`— y la pregunta es otra: no «quién es esta
 * persona» sino «cuál de ESTAS filas». Mandarla a `api/` devolvería clientes que
 * no están en la lista.
 *
 * ── El defecto que NO se va a repetir ───────────────────────────────────────
 *
 * El filtro de Clientes vivía en el navegador y hacía `toLowerCase()` sin tocar
 * los acentos. Medido sobre datos reales: «gomez» NO encontraba a «Rosa Elena
 * Padilla Gómez». En Colombia eso es la mitad de los apellidos, y nadie los
 * teclea con tilde. Por eso el primer test de este archivo es ese caso.
 */

function fila(parcial: Partial<DireccionALlamar>): DireccionALlamar {
  return {
    clienteId: 'c1',
    nombre: 'Rosa Elena Padilla Gómez',
    apodo: null,
    documento: '79123456',
    direccionId: 'd1',
    etiqueta: 'la casa',
    direccion: 'Calle 5 #3-20, Barrio El Centro',
    diasSinComprar: 12,
    urgencia: 'aviso',
    ventaSinDireccion: false,
    ventaId: 'v1',
    cuantasVentas: 3,
    telefonos: [],
    ...parcial,
  }
}

describe('las tildes no esconden a nadie', () => {
  it('«gomez» encuentra a «Rosa Elena Padilla Gómez» — el defecto histórico', () => {
    const filas = [fila({})]

    expect(filtrarSeguimientos(filas, 'gomez')).toHaveLength(1)
  })

  it('escrito CON tilde también lo encuentra: no se premia ni se castiga teclearla', () => {
    const filas = [fila({})]

    expect(filtrarSeguimientos(filas, 'Gómez')).toHaveLength(1)
  })

  it('la eñe se trata como las tildes: «munoz» encuentra a «Muñoz»', () => {
    const filas = [fila({ nombre: 'Pedro Muñoz' })]

    expect(filtrarSeguimientos(filas, 'munoz')).toHaveLength(1)
    expect(filtrarSeguimientos(filas, 'muñoz')).toHaveLength(1)
  })

  it('normaliza igual que `api/`: mismo mapa de caracteres', () => {
    expect(sinTildes('áéíóúüñÁÉÍÓÚÜÑ')).toBe('aeiouunaeiouun')
  })
})

describe('por dónde se busca a alguien', () => {
  it('por su apodo: es lo que recuerda quien marca — RN-CLI-17', () => {
    const filas = [fila({ nombre: 'Yeimy Padilla', apodo: 'La Flaca' })]

    expect(filtrarSeguimientos(filas, 'flaca')).toHaveLength(1)
  })

  it('por su apellido, que ya viene dentro de `nombre` — ADR-0006', () => {
    const filas = [fila({ nombre: 'Rosa Elena Padilla Gómez' })]

    expect(filtrarSeguimientos(filas, 'padilla')).toHaveLength(1)
  })

  it('por su cédula, aunque se escriba solo un tramo', () => {
    const filas = [fila({ documento: '79123456' })]

    expect(filtrarSeguimientos(filas, '1234')).toHaveLength(1)
  })

  it('por la dirección y por la etiqueta: la fila es una PUERTA, no un cliente', () => {
    const filas = [fila({ etiqueta: 'el local', direccion: 'Carrera 9 #12-4' })]

    expect(filtrarSeguimientos(filas, 'local')).toHaveLength(1)
    expect(filtrarSeguimientos(filas, 'carrera 9')).toHaveLength(1)
  })

  it('un apodo o una dirección en `null` no rompen la búsqueda', () => {
    const filas = [fila({ apodo: null, direccion: null, etiqueta: null, documento: null })]

    expect(filtrarSeguimientos(filas, 'gomez')).toHaveLength(1)
    expect(filtrarSeguimientos(filas, 'flaca')).toHaveLength(0)
  })
})

describe('la guarda de los dígitos', () => {
  /*
   * El mismo defecto que `buscarClientes` documenta en `api/`: si el documento
   * se cotejara con los dígitos del término SIEMPRE, un término sin dígitos
   * dejaría el patrón vacío —y «contiene la cadena vacía» es verdadero para
   * todas las filas—. El filtro devolvería la lista entera y parecería roto
   * justo cuando alguien busca por nombre, que es el caso más común.
   */
  it('un término sin dígitos NO hace coincidir a todos por el documento', () => {
    const filas = [
      fila({ clienteId: 'c1', nombre: 'Rosa Gómez', documento: '79123456' }),
      fila({ clienteId: 'c2', nombre: 'Pedro Muñoz', documento: '80999111' }),
    ]

    const visibles = filtrarSeguimientos(filas, 'gomez')

    expect(visibles).toHaveLength(1)
    expect(visibles[0]!.nombre).toBe('Rosa Gómez')
  })

  it('los puntos de una cédula dictada no estorban: «79.123» encuentra «79123456»', () => {
    const filas = [fila({ documento: '79123456' })]

    expect(filtrarSeguimientos(filas, '79.123')).toHaveLength(1)
  })

  /*
   * Tres dígitos, el mismo umbral que `buscarClientes` en `api/`.
   *
   * Con uno o dos, cotejar el documento es ruido: «9» aparece en casi toda
   * cédula del padrón. Y con el término «carrera 9» —que busca una DIRECCIÓN—
   * ese único dígito arrastraría filas que no tienen nada que ver.
   */
  it('uno o dos dígitos no cotejan el documento: serían ruido', () => {
    const filas = [
      fila({ clienteId: 'c1', nombre: 'Rosa Gómez', documento: '79123456', direccion: null }),
      fila({ clienteId: 'c2', nombre: 'Pedro Muñoz', documento: '80999111', direccion: null }),
    ]

    /* El «9» está en los dos documentos, y en ningún nombre ni etiqueta. */
    expect(filtrarSeguimientos(filas, '9')).toHaveLength(0)
  })
})

describe('sin búsqueda, la lista entera', () => {
  it('el término vacío devuelve todas las filas, en su orden original', () => {
    const filas = [fila({ clienteId: 'c1' }), fila({ clienteId: 'c2' })]

    expect(filtrarSeguimientos(filas, '')).toEqual(filas)
  })

  it('solo espacios es lo mismo que vacío', () => {
    const filas = [fila({}), fila({ clienteId: 'c2' })]

    expect(filtrarSeguimientos(filas, '   ')).toHaveLength(2)
  })

  /*
   * No hay mínimo de tres caracteres, y es una diferencia DELIBERADA con el
   * buscador de Clientes.
   *
   * Allá el mínimo existe por el costo: con uno o dos caracteres la consulta
   * devolvería casi toda la tabla, y es un viaje a la base por tecla. Acá no
   * hay viaje —las filas ya están en el navegador— así que esperar tres letras
   * sería hacer esperar por nada.
   */
  it('filtra desde la PRIMERA letra: acá no hay consulta que ahorrar', () => {
    const filas = [fila({ nombre: 'Rosa Gómez' }), fila({ clienteId: 'c2', nombre: 'Pedro Muñoz' })]

    /* La «g» separa: «Pedro Muñoz» no tiene ninguna, ni en su dirección. */
    expect(filtrarSeguimientos(filas, 'g')).toHaveLength(1)
  })
})

describe('cuando no coincide nada', () => {
  it('devuelve vacío, no la lista entera', () => {
    const filas = [fila({})]

    expect(filtrarSeguimientos(filas, 'zzzz')).toHaveLength(0)
  })
})
