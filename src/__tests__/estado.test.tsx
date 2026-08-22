import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DIAS_DE_AVISO_DE_VENCIMIENTO,
  Estado,
  ICONO_DE_ESTADO,
  TEXTO_DE_VENCIMIENTO,
  type Tono,
  estadoDeVencimiento,
} from '@/components/ui/estado'

const TONOS: Tono[] = ['cubierto', 'justo', 'expuesto']

/**
 * R40 · Nunca solo color.
 *
 * ```
 * dado    cualquier estado del semáforo
 * entonces se muestran simultáneamente color + forma + icono + texto en mayúsculas
 * ```
 *
 * El test recorre los cuatro canales por separado. Que estén los cuatro no es
 * decoración: es que el estado se siga leyendo cuando falten tres — en una
 * pantalla al sol, en modo de ahorro de batería, en una foto en blanco y negro,
 * o para quien no distingue verde de rojo.
 */
describe('R40 · un estado se dice por cuatro canales', () => {
  for (const tono of TONOS) {
    describe(`tono ${tono}`, () => {
      it('canal 1 · color: usa el par fondo/texto del sistema, no una clase suelta', () => {
        const { container } = render(<Estado tono={tono}>vigente</Estado>)
        const insignia = container.firstElementChild!

        // El par va junto: fondo y texto del MISMO estado. Es la regla D2, y
        // romperla es como nacen los cuatro botones invisibles de M2.
        const familia = { cubierto: 'exito', justo: 'alerta', expuesto: 'error' }[tono]
        expect(insignia.className).toContain(`bg-${familia}-fondo`)
        expect(insignia.className).toContain(`text-${familia}-texto`)
      })

      it('canal 2 · forma: lleva una clase de forma distinta a la de los otros tonos', () => {
        const { container } = render(<Estado tono={tono}>vigente</Estado>)

        const conForma = container.querySelector(`.aq-forma-${tono}`)
        expect(conForma, `falta .aq-forma-${tono}`).not.toBeNull()
      })

      it('canal 3 · icono: hay un SVG además del texto', () => {
        const { container } = render(<Estado tono={tono}>vigente</Estado>)

        expect(container.querySelector('svg')).not.toBeNull()
      })

      it('canal 4 · texto: va en mayúsculas por CSS, no escrito a mano', () => {
        const { container } = render(<Estado tono={tono}>vigente</Estado>)

        // El texto se escribe en minúscula y `.aq-micro` lo sube. Escribirlo
        // en mayúsculas en el código lo dejaría gritado también para un lector
        // de pantalla, que deletrea las siglas.
        expect(screen.getByText('vigente')).toBeInTheDocument()
        expect(container.firstElementChild!.className).toContain('aq-micro')
      })
    })
  }

  /**
   * Este es el que de verdad cuida R40. Si los tres tonos compartieran forma,
   * los tests de arriba pasarían igual y el semáforo seguiría siendo solo
   * color — que es exactamente lo que la regla prohíbe.
   */
  it('los tres tonos tienen formas DISTINTAS entre sí', () => {
    const formas = TONOS.map((tono) => {
      const { container } = render(<Estado tono={tono}>x</Estado>)
      const marca = container.querySelector('[aria-hidden]')!

      return [...marca.classList].find((c) => c.startsWith('aq-forma-'))
    })

    expect(new Set(formas).size).toBe(3)
    expect(formas.every(Boolean)).toBe(true)
  })

  it('los tres tonos tienen iconos DISTINTOS entre sí', () => {
    const iconos = TONOS.map((tono) => {
      const { container } = render(<Estado tono={tono}>x</Estado>)

      // Lucide marca cada icono con su propia clase `lucide-<nombre>`.
      return [...container.querySelectorAll('svg')]
        .flatMap((svg) => [...svg.classList])
        .find((c) => c.startsWith('lucide-'))
    })

    expect(new Set(iconos).size).toBe(3)
  })
})

/**
 * «Nunca dos iconos distintos para el mismo concepto» — paso 2 de T6.
 *
 * Es la regla más fácil de romper sin darse cuenta, porque se rompe en dos
 * archivos que nadie mira juntos: la tabla de stock marcaba las unidades
 * vencidas con un triángulo de alerta mientras la insignia de lotes usaba una
 * equis. Los dos decían «vencido» y no se parecían en nada.
 */
describe('un concepto, un icono', () => {
  it('el icono de cada estado sale de una sola fuente', () => {
    // Si alguien escribe un icono a mano en un componente en vez de leerlo de
    // acá, este test no lo ve — pero al menos la fuente existe y es una.
    expect(Object.keys(ICONO_DE_ESTADO).sort()).toEqual(['cubierto', 'expuesto', 'justo'])
  })

  it('la insignia pinta exactamente el icono de esa fuente', () => {
    for (const tono of TONOS) {
      const { container } = render(<Estado tono={tono}>x</Estado>)
      const enPantalla = [...container.querySelectorAll('svg')]
        .flatMap((svg) => [...svg.classList])
        .find((c) => c.startsWith('lucide-'))

      // `lucide-check` para el componente `Check`, etc.
      const esperado = `lucide-${nombreLucide(ICONO_DE_ESTADO[tono])}`
      expect(enPantalla, `${tono} pinta ${enPantalla} y la fuente dice ${esperado}`).toBe(esperado)
    }
  })
})

/** `AlertTriangle` → `alert-triangle`, que es como Lucide nombra su clase. */
function nombreLucide(icono: (typeof ICONO_DE_ESTADO)[Tono]): string {
  const nombre = (icono as unknown as { displayName?: string }).displayName ?? ''

  return nombre
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * El vencimiento como estado del semáforo.
 *
 * `RN-STK-08` fija la vida útil en 30 días y bloquea lo vencido; el aviso previo
 * lo fija `RN-STK-11`. El test no valida el número: valida
 * que la frontera esté donde la constante dice, sea cual sea.
 */
describe('el vencimiento se traduce a un estado', () => {
  const hoy = '2026-08-22'

  it('un lote que ya venció está expuesto', () => {
    expect(estadoDeVencimiento('2026-08-21', hoy)).toBe('expuesto')
  })

  it('el día del vencimiento todavía NO está vencido', () => {
    // Vence «el» 22, no «antes del» 22: ese día el producto se puede vender.
    expect(estadoDeVencimiento(hoy, hoy)).not.toBe('expuesto')
  })

  it('dentro de la ventana de aviso está justo', () => {
    expect(estadoDeVencimiento(sumarDias(hoy, DIAS_DE_AVISO_DE_VENCIMIENTO), hoy)).toBe('justo')
  })

  it('un día después de la ventana ya está cubierto', () => {
    expect(estadoDeVencimiento(sumarDias(hoy, DIAS_DE_AVISO_DE_VENCIMIENTO + 1), hoy)).toBe(
      'cubierto',
    )
  })

  it('los tres estados tienen texto propio', () => {
    expect(new Set(Object.values(TEXTO_DE_VENCIMIENTO)).size).toBe(3)
  })

  /**
   * `hoy` entra por parámetro y no sale de `new Date()`. Si saliera del reloj,
   * el servidor y el browser podrían discrepar de huso y un lote estaría vencido
   * en una pantalla y vigente en la otra.
   */
  it('no depende del reloj de quien lo ejecuta', () => {
    const conUnHoyInventado = estadoDeVencimiento('2030-01-01', '2029-12-31')

    expect(conUnHoyInventado).toBe('justo')
  })
})

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)

  return d.toISOString().slice(0, 10)
}
