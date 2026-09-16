import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscarBaseParaPrestarAction } from '@/app/(app)/modulos/retornables/actions'
import type { Base } from '@/lib/api-types'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))

const { apiServerFetch } = await import('@/lib/api-server')

/**
 * El aviso temprano del código de base — RN-BAS-03.
 *
 * ── Qué vigila este archivo ─────────────────────────────────────────────────
 *
 * Que un sticker que `api/` va a rechazar se diga ANTES de cobrar, y no después
 * de que la venta entera rebote. La validación de verdad sigue en `api/`
 * (`basePorSticker` + `prestarBaseEn`): esto es una pista, no la barrera.
 *
 * Lo más importante que se vigila acá es el caso feo: si la consulta falla, el
 * campo NO puede decir «disponible». Un falso verde manda a cobrar una venta
 * que va a rebotar igual, y encima con el cliente ya confiado.
 */

const base = (parcial: Partial<Base>): Base =>
  ({
    id: 'b1',
    idSticker: '0042',
    estado: 'sana',
    ubicacion: null,
    direccionId: null,
    activa: true,
    ...parcial,
  }) as Base

function devuelve(bases: Base[]): void {
  vi.mocked(apiServerFetch).mockResolvedValue(bases)
}

afterEach(() => {
  vi.mocked(apiServerFetch).mockReset()
})

describe('la base está lista para salir', () => {
  it('la reconoce en bodega y sana', async () => {
    devuelve([base({})])

    expect(await buscarBaseParaPrestarAction('0042')).toEqual({
      estado: 'disponible',
      idSticker: '0042',
    })
  })

  it('ignora los espacios que deja el lector o el dedo', async () => {
    devuelve([base({})])

    expect(await buscarBaseParaPrestarAction('  0042  ')).toMatchObject({ estado: 'disponible' })
  })
})

describe('la base existe pero no se puede prestar', () => {
  it('dice a quién la tiene, que es lo que hay que ir a buscar', async () => {
    devuelve([
      base({
        ubicacion: {
          direccionId: 'd1',
          etiqueta: 'La casa',
          legible: 'CL 30 # 12 - 45',
          clienteId: 'c1',
          clienteNombre: 'Juan Pérez',
        },
      }),
    ])

    expect(await buscarBaseParaPrestarAction('0042')).toEqual({
      estado: 'prestada',
      idSticker: '0042',
      clienteNombre: 'Juan Pérez',
      etiqueta: 'La casa',
    })
  })

  it('avisa que está dañada', async () => {
    devuelve([base({ estado: 'danada' })])

    expect(await buscarBaseParaPrestarAction('0042')).toEqual({
      estado: 'danada',
      idSticker: '0042',
    })
  })

  /*
   * `prestarBaseEn` mira PRIMERO dónde está y después si está dañada. Si acá se
   * invirtiera el orden, el campo diría «dañada» y al cobrar `api/` respondería
   * «prestada en otra dirección»: dos diagnósticos distintos para la misma base
   * y ninguna forma de saber cuál creer.
   */
  it('con las dos cosas mal, dice lo mismo que va a decir api: prestada', async () => {
    devuelve([
      base({
        estado: 'danada',
        ubicacion: {
          direccionId: 'd1',
          etiqueta: 'La casa',
          legible: 'CL 30 # 12 - 45',
          clienteId: 'c1',
          clienteNombre: 'Juan Pérez',
        },
      }),
    ])

    expect(await buscarBaseParaPrestarAction('0042')).toMatchObject({ estado: 'prestada' })
  })
})

describe('la base no figura', () => {
  /*
   * `GET /bases` filtra `activa = true`, así que una base dada de baja no viene
   * en la lista y desde acá es indistinguible de un código que nunca existió.
   * El mensaje los cubre a los dos en vez de afirmar cuál de los dos es.
   */
  it('trata igual al código inventado y al dado de baja', async () => {
    devuelve([base({ idSticker: '0099' })])

    expect(await buscarBaseParaPrestarAction('0042')).toEqual({
      estado: 'desconocida',
      sticker: '0042',
    })
  })

  it('con el parque vacío tampoco inventa una disponible', async () => {
    devuelve([])

    expect(await buscarBaseParaPrestarAction('0042')).toMatchObject({ estado: 'desconocida' })
  })
})

describe('sin sticker no hay nada que buscar', () => {
  it.each(['', '   '])('no pregunta al servidor con %j', async (vacio) => {
    expect(await buscarBaseParaPrestarAction(vacio)).toEqual({ estado: 'vacio' })
    expect(apiServerFetch).not.toHaveBeenCalled()
  })
})

describe('cuando la consulta falla', () => {
  /*
   * Este es el test que justifica el estado `indeterminado`.
   *
   * Devolver `desconocida` acusaría a un código que puede estar perfecto, y
   * devolver `disponible` daría un verde falso. Las dos mienten. La única
   * respuesta honesta es «no pude averiguarlo», y quien cobra decide: `api/`
   * sigue siendo la que valida al registrar la venta.
   */
  it('no dice disponible ni desconocida: dice que no pudo', async () => {
    vi.mocked(apiServerFetch).mockRejectedValue(new Error('api caída'))

    expect(await buscarBaseParaPrestarAction('0042')).toEqual({ estado: 'indeterminado' })
  })

  it('no bloquea: el que cobra sigue pudiendo intentar', async () => {
    vi.mocked(apiServerFetch).mockRejectedValue(new Error('api caída'))

    await expect(buscarBaseParaPrestarAction('0042')).resolves.toBeDefined()
  })
})
