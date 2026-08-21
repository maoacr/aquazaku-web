import { describe, expect, it } from 'vitest'
import type { Producto } from '@/lib/api-types'
import { analizarVendibilidad, avisoDeNoVendibles, necesitaDesglose } from '@/lib/productos'

function producto(sobrescribe: Partial<Producto> = {}): Producto {
  return {
    id: 'p1',
    codigo: 'P20U_600ML',
    nombre: 'Paca',
    presentacion: 'paca',
    contenidoMl: 600,
    unidades: 20,
    litros: '12.000',
    precioResidencial: '12000.00',
    precioComercial: '11000.00',
    precioMinimo: '9000.00',
    precioIncluyeImpuestos: true,
    tarifaIvaPorcentaje: '0.00',
    activo: true,
    createdAt: '',
    updatedAt: '',
    ...sobrescribe,
  }
}

const esperandoPrecio = producto({ id: 'a', activo: false, precioResidencial: '0.00' })
const faltaActivar = producto({ id: 'b', codigo: 'P50U_300ML', activo: false })
const vendible = producto({ id: 'c', codigo: 'BOT_20L' })

describe('analizarVendibilidad()', () => {
  it('la pregunta es si se puede vender, no si falta el precio', () => {
    const v = analizarVendibilidad([faltaActivar, vendible])

    // Tiene precio cargado y aun así no se vende: ese es el caso que se pasaba
    // por alto.
    expect(v.noVendibles).toHaveLength(1)
    expect(v.esperandoPrecio).toHaveLength(0)
    expect(v.soloFaltaActivar).toBe(1)
  })

  it('separa los dos motivos cuando conviven', () => {
    const v = analizarVendibilidad([esperandoPrecio, faltaActivar, vendible])

    expect(v.noVendibles).toHaveLength(2)
    expect(v.esperandoPrecio.map((p) => p.codigo)).toEqual(['P20U_600ML'])
    expect(v.soloFaltaActivar).toBe(1)
  })

  it('sin nada que avisar, no hay nada que avisar', () => {
    expect(analizarVendibilidad([vendible]).noVendibles).toHaveLength(0)
  })
})

describe('avisoDeNoVendibles() — un motivo, un mensaje', () => {
  it('un producto esperando precio lo dice completo, sin desglose', () => {
    expect(avisoDeNoVendibles(1, 1)).toBe(
      '1 producto está esperando su precio y no se puede vender todavía.',
    )
  })

  it('un producto al que solo le falta activarse dice exactamente eso', () => {
    expect(avisoDeNoVendibles(1, 0)).toBe(
      '1 producto ya tiene precio cargado: solo falta activarlo para poder venderlo.',
    )
  })

  it('concuerda en plural', () => {
    expect(avisoDeNoVendibles(2, 0)).toBe(
      '2 productos ya tienen precio cargado: solo falta activarlos para poder venderlos.',
    )
    expect(avisoDeNoVendibles(3, 3)).toBe(
      '3 productos están esperando su precio y no se pueden vender todavía.',
    )
  })

  it('con motivos mezclados el resumen no se compromete: el desglose lo explica', () => {
    expect(avisoDeNoVendibles(2, 1)).toBe('2 productos no se pueden vender todavía.')
  })
})

describe('necesitaDesglose()', () => {
  /**
   * La primera versión mostraba siempre resumen + desglose, y con un solo
   * producto quedaba diciendo lo mismo dos veces. Dos líneas que dicen lo mismo
   * hacen buscar una diferencia que no existe.
   */
  it('no desglosa cuando hay un solo motivo', () => {
    expect(necesitaDesglose(analizarVendibilidad([faltaActivar]))).toBe(false)
    expect(necesitaDesglose(analizarVendibilidad([esperandoPrecio]))).toBe(false)
  })

  it('desglosa solo cuando los dos motivos conviven', () => {
    expect(necesitaDesglose(analizarVendibilidad([esperandoPrecio, faltaActivar]))).toBe(true)
  })

  it('sin productos no vendibles no hay desglose', () => {
    expect(necesitaDesglose(analizarVendibilidad([vendible]))).toBe(false)
  })
})
