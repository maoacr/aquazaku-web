import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RangoDeFechas } from '@/components/ui/rango-de-fechas'

const empujar = vi.fn()
let params = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: empujar }),
  useSearchParams: () => params,
  usePathname: () => '/',
}))

/**
 * El control de rango del tablero.
 *
 * ── Por qué se mockea el reloj de la planta y no el reloj ───────────────────
 *
 * La primera versión de este archivo congelaba el sistema con
 * `vi.setSystemTime()` a las 02:00 UTC —las 21:00 del día anterior en Campo de
 * la Cruz— para probar que «Hoy» no se fuera al día siguiente. Dos problemas:
 *
 * 1. Los timers falsos se trababan con `userEvent`, que espera micro-tareas que
 *    con el reloj congelado nunca corren. La corrida se colgaba.
 * 2. Estaba probando la cosa equivocada. Que el día de la planta se calcule
 *    bien es responsabilidad de `hora-de-la-planta.ts`, que tiene once casos
 *    propios. Reprobarlo acá duplica la cobertura y deja este archivo atado a
 *    un detalle que no le toca.
 *
 * Lo que SÍ es responsabilidad de este componente es **usar ese helper** en vez
 * de hacer su propia aritmética con `toISOString()`. Mockeándolo con un día
 * conocido, eso queda probado: si alguien reemplaza la llamada por un
 * `new Date()`, los rangos dejan de salir del 5 de octubre y todo esto cae.
 */
vi.mock('@/lib/hora-de-la-planta', () => ({
  hoyEnLaPlanta: () => '2026-10-05',
}))

beforeEach(() => {
  empujar.mockClear()
  params = new URLSearchParams()
})

/** Los parámetros del último `push`. */
function ultimoRango() {
  const url = empujar.mock.calls.at(-1)?.[0] as string
  return new URLSearchParams(url.split('?')[1] ?? '')
}

const clic = async (nombre: RegExp | string) => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: nombre }))
}

describe('los atajos mandan el rango que dicen', () => {
  it('«Hoy» sale del helper de la planta, no de un new Date()', async () => {
    render(<RangoDeFechas desde="2026-09-01" hasta="2026-09-30" />)

    await clic('Hoy')

    // El helper mockeado dice 5 de octubre.
    expect(ultimoRango().get('desde')).toBe('2026-10-05')
    expect(ultimoRango().get('hasta')).toBe('2026-10-05')
  })

  /** Siete días son hoy y los seis anteriores, no hoy menos siete. */
  it('«7 días» cuenta hoy adentro', async () => {
    render(<RangoDeFechas desde="2026-09-01" hasta="2026-09-30" />)

    await clic('7 días')

    expect(ultimoRango().get('desde')).toBe('2026-09-29')
    expect(ultimoRango().get('hasta')).toBe('2026-10-05')
  })

  it('«30 días» también', async () => {
    render(<RangoDeFechas desde="2026-09-01" hasta="2026-09-30" />)

    await clic('30 días')

    expect(ultimoRango().get('desde')).toBe('2026-09-06')
  })

  it('«Este mes» arranca el día 1', async () => {
    render(<RangoDeFechas desde="2026-09-01" hasta="2026-09-30" />)

    await clic('Este mes')

    expect(ultimoRango().get('desde')).toBe('2026-10-01')
    expect(ultimoRango().get('hasta')).toBe('2026-10-05')
  })

  it('«Este año» arranca el 1 de enero', async () => {
    render(<RangoDeFechas desde="2026-09-01" hasta="2026-09-30" />)

    await clic('Este año')

    expect(ultimoRango().get('desde')).toBe('2026-01-01')
  })
})

describe('lo que el rango NO puede pisar', () => {
  /**
   * El tablero comparte la URL con otros parámetros —la granularidad del
   * gráfico, por ejemplo—. Si el rango los borrara, tocar «30 días» tiraría
   * abajo el corte que alguien acababa de elegir.
   */
  it('conserva los demás parámetros de la URL', async () => {
    params = new URLSearchParams({ granularidad: 'semana' })
    render(<RangoDeFechas desde="2026-09-01" hasta="2026-09-30" />)

    await clic('Hoy')

    expect(ultimoRango().get('granularidad')).toBe('semana')
  })
})

describe('el atajo activo se nota', () => {
  it('marca el que coincide con el rango actual', () => {
    // Del 6-sep al 5-oct son exactamente los últimos 30 días.
    render(<RangoDeFechas desde="2026-09-06" hasta="2026-10-05" />)

    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('con un rango a mano no marca ninguno', () => {
    render(<RangoDeFechas desde="2026-03-11" hasta="2026-07-02" />)

    for (const b of screen.getAllByRole('button')) {
      expect(b).not.toHaveAttribute('aria-pressed', 'true')
    }
  })
})

describe('el rango al revés', () => {
  /**
   * `api/` lo rechaza con un 422 y un mensaje, pero el error llegaría después
   * de un viaje y con el tablero anterior todavía en pantalla — que se lee
   * como si la consulta hubiera funcionado. Se frena acá además de allá.
   */
  it('avisa y no navega', async () => {
    render(<RangoDeFechas desde="2026-10-30" hasta="2026-10-01" />)

    expect(screen.getByText(/al revés|posterior/i)).toBeInTheDocument()

    await clic('Consultar')

    expect(empujar).not.toHaveBeenCalled()
  })
})
