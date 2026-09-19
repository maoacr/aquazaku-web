import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Filtros } from '@/app/(app)/modulos/reportes/filtros'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))

/**
 * Los filtros del extracto — RN-CON-04 y 08.
 *
 * ── Navegan, no piden datos ─────────────────────────────────────────────────
 *
 * Cambian la URL y dejan que el Server Component vuelva a consultar. El browser
 * nunca le habla a `api/` (ADR-0002), y además así el rango, los tipos y las
 * columnas quedan en la barra de direcciones: se comparten, se guardan, y el
 * «volver» del navegador funciona.
 *
 * Por eso los tests miran `router.push`: esa URL **es** la consulta.
 *
 * ── Las dos reglas que se vigilan acá ───────────────────────────────────────
 *
 * El rango invertido se frena en el cliente ADEMÁS de en el servidor. Sin eso,
 * el error llega después de un viaje y con el reporte anterior todavía en
 * pantalla, que se lee como si la consulta hubiera funcionado.
 *
 * Y el monto NO se puede quitar. Un extracto sin montos no es un extracto más
 * corto: es una lista de fechas con aspecto de reporte financiero.
 */

const RANGO = { desde: '2026-09-01', hasta: '2026-09-30' }

function pintar(over: Partial<Parameters<typeof Filtros>[0]> = {}) {
  return render(<Filtros desde={RANGO.desde} hasta={RANGO.hasta} tipos="" columnas="" {...over} />)
}

/** La URL a la que navegó, ya parseada. */
function ultimaConsulta(): URLSearchParams {
  const url = String(push.mock.calls.at(-1)![0])
  return new URLSearchParams(url.split('?')[1])
}

function pastilla(nombre: string): HTMLElement {
  return screen.getByRole('button', { name: nombre })
}

afterEach(() => {
  push.mockClear()
})

describe('el rango', () => {
  it('arranca con las fechas que vinieron del servidor', () => {
    pintar()

    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-01')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-09-30')
  })

  it('consultar navega con el rango elegido', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(ultimaConsulta().get('desde')).toBe('2026-09-01')
    expect(ultimaConsulta().get('hasta')).toBe('2026-09-30')
  })

  /*
   * Un rango invertido no devuelve nada, y ese vacío se lee como «no hubo
   * movimientos» — que es una conclusión contable equivocada.
   */
  it('un rango invertido bloquea el botón', () => {
    pintar({ desde: '2026-09-30', hasta: '2026-09-01' })

    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled()
  })

  it('y lo explica sin dejar que se consulte al pedo', () => {
    pintar({ desde: '2026-09-30', hasta: '2026-09-01' })

    expect(screen.getByText(/se lee como «no hubo movimientos»/)).toBeInTheDocument()
  })

  it('con el rango en orden no muestra la advertencia', () => {
    pintar()

    expect(screen.queryByText(/no hubo movimientos/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeEnabled()
  })

  it('el mismo día de ida y vuelta es un rango válido', () => {
    pintar({ desde: '2026-09-18', hasta: '2026-09-18' })

    expect(screen.getByRole('button', { name: 'Consultar' })).toBeEnabled()
  })
})

describe('los tipos de movimiento', () => {
  /*
   * Sin elección, TODOS están activos: una pantalla que arranca sin nada
   * marcado y muestra todo haría pensar que el filtro no anda.
   */
  it('sin elegir nada, todos se ven activos', () => {
    pintar({ tipos: '' })

    for (const nombre of ['Ventas', 'Cobros', 'Compras', 'Devoluciones', 'Recargos por daño']) {
      expect(pastilla(nombre)).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('y lo dice con todas las letras', () => {
    pintar({ tipos: '' })

    expect(screen.getByText('Todos los movimientos.')).toBeInTheDocument()
  })

  it('con una elección, las demás se apagan', () => {
    pintar({ tipos: 'venta' })

    expect(pastilla('Ventas')).toHaveAttribute('aria-pressed', 'true')
    expect(pastilla('Cobros')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('Todos los movimientos.')).not.toBeInTheDocument()
  })

  it('tocar una la agrega a la URL', async () => {
    const usuario = userEvent.setup()
    pintar({ tipos: '' })

    await usuario.click(pastilla('Cobros'))

    expect(ultimaConsulta().get('tipos')).toBe('cobro')
  })

  it('tocar otra la suma en vez de reemplazarla', async () => {
    const usuario = userEvent.setup()
    pintar({ tipos: 'venta' })

    await usuario.click(pastilla('Cobros'))

    expect(ultimaConsulta().get('tipos')).toBe('venta,cobro')
  })

  it('volver a tocar una elegida la saca', async () => {
    const usuario = userEvent.setup()
    pintar({ tipos: 'venta,cobro' })

    await usuario.click(pastilla('Ventas'))

    expect(ultimaConsulta().get('tipos')).toBe('cobro')
  })

  /*
   * Sacar la última quita el parámetro en vez de mandarlo vacío: `tipos=` sería
   * «ningún tipo», y la consulta volvería sin filas.
   */
  it('sacar la última borra el parámetro, no lo manda vacío', async () => {
    const usuario = userEvent.setup()
    pintar({ tipos: 'venta' })

    await usuario.click(pastilla('Ventas'))

    expect(ultimaConsulta().has('tipos')).toBe(false)
  })
})

describe('las columnas', () => {
  it('sin elección muestra las de siempre', () => {
    pintar({ columnas: '' })

    expect(pastilla('Fecha')).toHaveAttribute('aria-pressed', 'true')
    expect(pastilla('Monto')).toHaveAttribute('aria-pressed', 'true')
    expect(pastilla('Detalle')).toHaveAttribute('aria-pressed', 'false')
  })

  /*
   * La regla vive en `columnasVisibles`, así que el CSV tampoco puede salir sin
   * el monto. Esta pastilla solo lo hace visible.
   */
  it('el monto no se puede quitar', () => {
    pintar({ columnas: '' })

    expect(pastilla('Monto')).toBeDisabled()
  })

  it('y dice por qué, sin que haya que intentarlo', () => {
    pintar({ columnas: '' })

    expect(pastilla('Monto')).toHaveAttribute(
      'title',
      expect.stringContaining('sin él, el extracto no dice nada'),
    )
  })

  it('las demás columnas sí se pueden tocar', () => {
    pintar({ columnas: '' })

    expect(pastilla('Fecha')).toBeEnabled()
    expect(pastilla('Detalle')).toBeEnabled()
  })

  it('agregar una columna la suma a la URL', async () => {
    const usuario = userEvent.setup()
    pintar({ columnas: 'fecha,monto' })

    await usuario.click(pastilla('Detalle'))

    expect(ultimaConsulta().get('columnas')).toBe('fecha,monto,detalle')
  })

  it('quitar una la saca', async () => {
    const usuario = userEvent.setup()
    pintar({ columnas: 'fecha,monto,detalle' })

    await usuario.click(pastilla('Detalle'))

    expect(ultimaConsulta().get('columnas')).toBe('fecha,monto')
  })

  it('cambiar columnas conserva el rango: no se pierde la consulta', async () => {
    const usuario = userEvent.setup()
    pintar({ columnas: 'fecha,monto' })

    await usuario.click(pastilla('Detalle'))

    expect(ultimaConsulta().get('desde')).toBe('2026-09-01')
    expect(ultimaConsulta().get('hasta')).toBe('2026-09-30')
  })
})

/**
 * La descarga.
 *
 * Es un enlace común, no un `fetch`: el navegador la maneja con su propia barra
 * de progreso y su carpeta de siempre. Y lleva los MISMOS parámetros que la
 * pantalla — lo que se ve es lo que se baja.
 */
describe('el CSV', () => {
  it('es un enlace, no un botón', () => {
    pintar()

    expect(screen.getByRole('link', { name: /CSV/ })).toBeInTheDocument()
  })

  it('lleva el mismo rango que la pantalla', () => {
    pintar()

    const href = screen.getByRole('link', { name: /CSV/ }).getAttribute('href')!
    const q = new URLSearchParams(href.split('?')[1])
    expect(q.get('desde')).toBe('2026-09-01')
    expect(q.get('hasta')).toBe('2026-09-30')
  })

  /*
   * Apunta al rango CONSULTADO, no al que está escrito en los campos. Si
   * alguien cambia la fecha y no aprieta Consultar, baja lo que está viendo —
   * no un reporte que nunca vio.
   */
  it('apunta al rango consultado, no al que se está escribiendo', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.clear(screen.getByLabelText('Desde'))
    await usuario.type(screen.getByLabelText('Desde'), '2026-01-01')

    const href = screen.getByRole('link', { name: /CSV/ }).getAttribute('href')!
    expect(new URLSearchParams(href.split('?')[1]).get('desde')).toBe('2026-09-01')
  })
})

/**
 * El PDF lo hace el navegador con «Guardar como PDF».
 *
 * Así el archivo es exactamente lo que está en pantalla, y el contador elige el
 * tamaño de papel — que ninguna librería del servidor puede adivinar.
 */
describe('imprimir', () => {
  it('le pide el diálogo al navegador en vez de generar un PDF en el servidor', async () => {
    const imprimir = vi.fn()
    vi.stubGlobal('print', imprimir)
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(screen.getByRole('button', { name: /Imprimir o PDF/ }))

    expect(imprimir).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
