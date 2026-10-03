import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ListaDeAbonos, RegistrarAbono } from '@/components/ventas/abonos'
import { registrarCobroAction } from '@/app/(app)/modulos/ventas/actions'
import type { Cobro } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/ventas/actions', () => ({
  registrarCobroAction: vi.fn(),
}))

/**
 * Abonar y saldar la deuda desde la ficha — RN-VEN-07.
 *
 * ── Lo que se vigila ────────────────────────────────────────────────────────
 *
 * Que el TECHO del abono salga del servidor. `api/` rechaza cobrar más que la
 * deuda (no existe saldo a favor: ningún módulo sabría gastarlo), así que la
 * única forma de que el formulario no mande un monto condenado es leer la deuda
 * real. Un máximo escrito a mano acá mentiría el día que la deuda baje.
 *
 * Que con la deuda en cero NO haya botón. Cualquier monto rebotaría con
 * `COBRO_MAYOR_QUE_LA_DEUDA`, y un botón que siempre falla enseña a ignorar los
 * errores.
 *
 * Que el formulario se ENVÍE de verdad, con el monto y el medio puestos. Un
 * cobro es inmutable —no hay `UPDATE` ni `DELETE`— así que un campo que no
 * viaja no se arregla después: queda otro documento encima.
 */

const cliente = { id: 'cli-1', nombre: 'Rosa Padilla' }

const cobro = (extra: Partial<Cobro> = {}): Cobro => ({
  id: 'cob-1',
  clienteId: 'cli-1',
  monto: '20000.00',
  medioDePago: 'efectivo',
  observaciones: null,
  registradoPor: 'usr-1',
  createdAt: '2026-09-20T15:30:00Z',
  ...extra,
})

function abrir(deuda = '80000.00') {
  render(<RegistrarAbono cliente={cliente} deuda={deuda} />)
  fireEvent.click(screen.getByRole('button', { name: /registrar un abono/i }))
}

const monto = () => screen.getByRole('spinbutton', { name: /monto/i }) as HTMLInputElement
const guardar = () => screen.getByRole('button', { name: /registrar el abono/i })

describe('cuándo se puede abonar', () => {
  /**
   * Sin deuda no hay abono, y la pantalla dice por qué.
   *
   * No es un botón deshabilitado: es la ausencia del botón más la razón. Un
   * control apagado sin motivo se intenta tres veces antes de preguntar.
   */
  it('con la deuda en cero no hay botón, y explica el motivo', () => {
    render(<RegistrarAbono cliente={cliente} deuda="0.00" />)

    expect(screen.queryByRole('button', { name: /registrar un abono/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no debe nada/i)).toBeInTheDocument()
  })

  it('con deuda, el formulario no está montado hasta que alguien lo abre', () => {
    render(<RegistrarAbono cliente={cliente} deuda="80000.00" />)

    expect(screen.queryByRole('spinbutton', { name: /monto/i })).not.toBeInTheDocument()
  })
})

describe('el techo sale del servidor', () => {
  /**
   * La deuda se MUESTRA, no se asume.
   *
   * Quien abona está por registrar algo que no se puede editar. Ver contra qué
   * número se está cobrando es lo que evita el abono de $800.000 sobre una
   * deuda de $80.000 que `api/` iba a rebotar igual.
   */
  it('el modal muestra la deuda contra la que se abona', () => {
    abrir('80000.00')

    expect(screen.getByText(/debe hoy/i).parentElement).toHaveTextContent('$80.000')
  })

  it('el campo no acepta más que la deuda', () => {
    abrir('80000.00')

    expect(monto().max).toBe('80000')
  })

  /**
   * «Saldar todo» no es un segundo endpoint: es el mismo abono por el monto
   * exacto. Precargarlo evita que alguien teclee 79.999 y deje un peso de deuda
   * que después nadie entiende.
   */
  it('saldar todo precarga el monto exacto de la deuda', () => {
    abrir('80000.00')

    fireEvent.click(screen.getByRole('button', { name: /saldar todo/i }))

    expect(monto().value).toBe('80000')
  })

  /**
   * Pasarse apaga el botón CON el motivo escrito. El piso real lo pone `api/`;
   * acá se dice qué falta antes del viaje, en vez de volver con un 422.
   */
  it('un monto mayor que la deuda apaga el botón y dice por qué', () => {
    abrir('80000.00')

    fireEvent.change(monto(), { target: { value: '90000' } })

    expect(guardar()).toBeDisabled()
    expect(screen.getByText(/no puede ser mayor que la deuda/i)).toBeInTheDocument()
  })

  it('un monto de cero apaga el botón', () => {
    abrir('80000.00')

    fireEvent.change(monto(), { target: { value: '0' } })

    expect(guardar()).toBeDisabled()
  })

  /**
   * Lo que queda después del abono se muestra ANTES de registrarlo. Es el
   * cálculo que la persona hace de cabeza, y es el que decide si el abono es el
   * correcto.
   */
  it('adelanta cuánto queda después del abono', () => {
    abrir('80000.00')

    fireEvent.change(monto(), { target: { value: '30000' } })

    expect(screen.getByText(/quedarían \$50.000/i)).toBeInTheDocument()
  })

  it('cuando el abono cubre todo, lo dice', () => {
    abrir('80000.00')

    fireEvent.change(monto(), { target: { value: '80000' } })

    expect(screen.getByText(/queda al día/i)).toBeInTheDocument()
  })
})

describe('lo que viaja', () => {
  /**
   * El camino feliz, apretando el botón de verdad.
   *
   * Sin esto el test suite puede estar entero en verde sobre un formulario que
   * nunca registró un peso.
   */
  it('registra el abono con el cliente, el monto y el medio', async () => {
    vi.mocked(registrarCobroAction).mockResolvedValue({ ok: 'Cobro registrado.', token: 'tok-1' })

    abrir('80000.00')
    fireEvent.change(monto(), { target: { value: '30000' } })
    fireEvent.change(screen.getByRole('combobox', { name: /medio de pago/i }), {
      target: { value: 'transferencia' },
    })
    fireEvent.submit(monto().closest('form')!)

    await waitFor(() => expect(registrarCobroAction).toHaveBeenCalled())

    const enviado = vi.mocked(registrarCobroAction).mock.calls[0]![1]
    expect(enviado.get('clienteId')).toBe('cli-1')
    expect(enviado.get('monto')).toBe('30000')
    expect(enviado.get('medioDePago')).toBe('transferencia')
  })

  it('el medio de pago arranca en efectivo: es el que más pasa en la planta', () => {
    abrir('80000.00')

    expect((screen.getByRole('combobox', { name: /medio de pago/i }) as HTMLSelectElement).value).toBe(
      'efectivo',
    )
  })

  /**
   * `credito` no es un medio de PAGO: la base tiene un `CHECK` que lo prohíbe
   * (`cobros_no_se_pagan_a_credito`). Ofrecerlo sería ofrecer un error.
   */
  it('no ofrece pagar un crédito con crédito', () => {
    abrir('80000.00')

    const opciones = screen
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value)

    expect(opciones).not.toContain('credito')
  })

  /**
   * El medio de pago sobrevive al rechazo.
   *
   * React resetea el formulario cuando la acción termina, sin distinguir el
   * error. Con el medio no controlado, un cobro rechazado por el monto volvía a
   * «Efectivo» en silencio: quien corrige el monto y reintenta no vuelve a mirar
   * el medio, y la transferencia queda registrada como efectivo. Un cobro no se
   * edita, así que la caja no cuadra y no hay cómo arreglarlo.
   */
  it('el medio de pago elegido sobrevive a un cobro rechazado', async () => {
    vi.mocked(registrarCobroAction).mockResolvedValue({ error: 'El monto no cuadra.' })

    abrir('80000.00')
    const medio = screen.getByRole('combobox', { name: /medio de pago/i }) as HTMLSelectElement
    fireEvent.change(medio, { target: { value: 'transferencia' } })
    fireEvent.change(monto(), { target: { value: '90000' } })
    fireEvent.submit(monto().closest('form')!)

    expect(await screen.findByText(/El monto no cuadra/)).toBeInTheDocument()
    expect(
      (screen.getByRole('combobox', { name: /medio de pago/i }) as HTMLSelectElement).value,
    ).toBe('transferencia')
  })

  it('muestra el error que devuelve api/', async () => {
    vi.mocked(registrarCobroAction).mockResolvedValue({ error: 'Rosa debe $80.000 y este cobro…' })

    abrir('80000.00')
    fireEvent.change(monto(), { target: { value: '30000' } })
    fireEvent.submit(monto().closest('form')!)

    expect(await screen.findByText(/Rosa debe \$80.000/)).toBeInTheDocument()
  })
})

describe('el libro de abonos', () => {
  it('sin abonos, lo dice en vez de dejar un hueco', () => {
    render(<ListaDeAbonos cobros={[]} />)

    expect(screen.getByText(/todavía no hay abonos/i)).toBeInTheDocument()
  })

  it('cada abono muestra el monto, el medio y la fecha', () => {
    render(<ListaDeAbonos cobros={[cobro()]} />)

    expect(screen.getByText(/\$20.000/)).toBeInTheDocument()
    expect(screen.getByText(/efectivo/i)).toBeInTheDocument()
    expect(screen.getByText(/20\/09\/26/)).toBeInTheDocument()
  })

  it('las observaciones se muestran cuando están', () => {
    render(<ListaDeAbonos cobros={[cobro({ observaciones: 'pagó en la tienda' })]} />)

    expect(screen.getByText(/pagó en la tienda/i)).toBeInTheDocument()
  })
})
