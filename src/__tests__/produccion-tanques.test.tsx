import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AjustarAgua, RegistrarReposicion, Tanques } from '@/components/produccion/tanques'
import type { SaldoDeAgua } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/produccion/actions', () => ({
  ajustarAguaAction: vi.fn(async () => ({})),
  registrarReposicionAction: vi.fn(async () => ({})),
}))

vi.mock('sileo', () => ({ sileo: { success: vi.fn(), warning: vi.fn() } }))

/**
 * Los tanques de agua — M4.
 *
 * ── Los dos números dicen cosas distintas ───────────────────────────────────
 *
 * Los litros son lo que dice el LIBRO, y ese manda (RN-PRD-14). El nivel es a
 * qué se parecería eso mirando el tanque, y sirve para una sola cosa: poder
 * compararlo con lo que se ve. Si el libro dice «medio» y el tanque se ve
 * lleno, hay algo sin registrar.
 *
 * ── Un saldo negativo NO es un tanque vacío ─────────────────────────────────
 *
 * Es un libro al que se le perdió una entrada. Decir «vacío» esconde justamente
 * eso: se lee como una situación normal cuando es una discrepancia. Y pasa de
 * forma esperable — el ingreso de la red se registra sin cantidad (RN-PRD-11),
 * así que hasta el primer ajuste el consumo baja un saldo que nunca subió.
 */

function saldo(over: Partial<SaldoDeAgua> = {}): SaldoDeAgua {
  return {
    tanque: 'crudo',
    litros: 2000,
    capacidad: 4000,
    nivelCalculado: 'medio',
    ...over,
  }
}

describe('Tanques — lo que muestra cada tarjeta', () => {
  it('nombra los dos tanques y explica qué hay en cada uno', () => {
    render(
      <Tanques
        saldos={[saldo({ tanque: 'crudo' }), saldo({ tanque: 'procesado' })]}
      />,
    )

    expect(screen.getByText('Agua cruda')).toBeInTheDocument()
    expect(screen.getByText('Agua procesada')).toBeInTheDocument()
    expect(screen.getByText(/red municipal/)).toBeInTheDocument()
  })

  /*
   * RN-PRD-21: son dos tanques de 2.000 L que se operan en PARALELO, no uno
   * detrás del otro. Por eso el saldo es uno solo de 4.000.
   */
  it('aclara que el agua procesada son dos tanques en paralelo', () => {
    render(<Tanques saldos={[saldo({ tanque: 'procesado' })]} />)

    expect(screen.getByText(/dos tanques de 2.000 L que se usan en paralelo/)).toBeInTheDocument()
  })

  it('muestra los litros con separadores de miles, sobre la capacidad', () => {
    render(<Tanques saldos={[saldo({ litros: 3500, capacidad: 4000 })]} />)

    expect(screen.getByText('3.500')).toBeInTheDocument()
    expect(screen.getByText(/de 4.000 L/)).toBeInTheDocument()
  })

  /*
   * El nivel va como TEXTO, no como una barra llena de color: no es una
   * medición, es una traducción del número a algo que el ojo pueda contrastar.
   */
  it('traduce el saldo a un nivel que se pueda comparar con el ojo', () => {
    render(<Tanques saldos={[saldo({ nivelCalculado: 'tres_cuartos' })]} />)

    expect(screen.getByText('tres cuartos')).toBeInTheDocument()
    expect(screen.getByText(/Si el tanque se ve distinto, hay algo sin registrar/)).toBeInTheDocument()
  })

  it.each([
    ['vacio', 'vacío'],
    ['un_cuarto', 'un cuarto'],
    ['medio', 'medio'],
    ['lleno', 'lleno'],
  ])('el nivel %s se dice «%s», en castellano', (nivel, texto) => {
    render(<Tanques saldos={[saldo({ nivelCalculado: nivel as SaldoDeAgua['nivelCalculado'] })]} />)

    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it('sin saldos no dibuja ninguna tarjeta', () => {
    render(<Tanques saldos={[]} />)

    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})

describe('Tanques — el saldo negativo se llama por su nombre', () => {
  it('dice que el libro quedó corto, no que el tanque está vacío', () => {
    render(<Tanques saldos={[saldo({ litros: -350, nivelCalculado: 'vacio' })]} />)

    expect(screen.getByText(/El libro quedó corto/)).toBeInTheDocument()
    expect(screen.queryByText(/El libro lo pone en/)).not.toBeInTheDocument()
  })

  it('dice en cuánto quedó corto, en positivo', () => {
    render(<Tanques saldos={[saldo({ litros: -350 })]} />)

    expect(screen.getByText('350')).toBeInTheDocument()
  })

  /*
   * El mensaje dice QUÉ HACER en vez de solo marcar el problema: es una
   * situación esperable, no un bug.
   */
  it('dice qué hacer, no solo que algo está mal', () => {
    render(<Tanques saldos={[saldo({ litros: -350 })]} />)

    expect(screen.getByText(/mire el nivel real y ajuste el saldo/)).toBeInTheDocument()
  })

  it('con saldo positivo no habla de libro corto', () => {
    render(<Tanques saldos={[saldo({ litros: 2000 })]} />)

    expect(screen.queryByText(/El libro quedó corto/)).not.toBeInTheDocument()
    expect(screen.getByText(/El libro lo pone en/)).toBeInTheDocument()
  })

  it('un cero no es negativo: sigue siendo un saldo normal', () => {
    render(<Tanques saldos={[saldo({ litros: 0, nivelCalculado: 'vacio' })]} />)

    expect(screen.queryByText(/El libro quedó corto/)).not.toBeInTheDocument()
  })

  it('una capacidad de cero no rompe la tarjeta', () => {
    render(<Tanques saldos={[saldo({ litros: 0, capacidad: 0 })]} />)

    expect(screen.getByText(/de 0 L/)).toBeInTheDocument()
  })
})

/**
 * «Llegó agua y se llenó el tanque» — sin cantidad, y eso es RN-PRD-11.
 *
 * No hay medidor ni regleta. Si el formulario pidiera litros, alguien los
 * completaría a ojo y el sistema convertiría un hueco conocido en un número que
 * parece medido. El día que el saldo no cuadre, nadie sabría si el problema fue
 * el consumo, la merma o esa estimación.
 */
describe('RegistrarReposicion — no pide litros a propósito', () => {
  it('NO ofrece ningún campo de cantidad', () => {
    render(<RegistrarReposicion />)

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/litros/i)).not.toBeInTheDocument()
  })

  it('explica por qué no los pide, en vez de dejar la duda', () => {
    render(<RegistrarReposicion />)

    expect(screen.getByText(/no hay con qué medirlos/)).toBeInTheDocument()
    expect(screen.getByText(/ensucia el balance para siempre/)).toBeInTheDocument()
  })

  it('solo pregunta a qué tanque llegó', () => {
    render(<RegistrarReposicion />)

    expect(screen.getByRole('combobox', { name: /Tanque/ })).toHaveValue('crudo')
  })

  it('el botón dice «Anotar»: se anota un hecho, no se mide nada', () => {
    render(<RegistrarReposicion />)

    expect(screen.getByRole('button', { name: 'Anotar' })).toBeInTheDocument()
  })
})

/**
 * El ajuste.
 *
 * Es un permiso aparte del de reposición: registrar que llegó agua es contar un
 * HECHO observado; corregir un saldo que no cuadra es otra cosa, y quien opera
 * la planta no debería poder tapar su propia discrepancia.
 */
describe('AjustarAgua — el resultado se ve antes de confirmar', () => {
  const SALDOS = [
    saldo({ tanque: 'crudo', litros: 2000, capacidad: 4000 }),
    saldo({ tanque: 'procesado', litros: 1000, capacidad: 4000 }),
  ]

  it('aclara que la diferencia va con signo y que un cero no ajusta nada', () => {
    render(<AjustarAgua saldos={SALDOS} />)

    expect(screen.getByText(/Un cero no\s+ajusta nada/)).toBeInTheDocument()
  })

  it('sin escribir diferencia no adelanta ningún resultado', () => {
    render(<AjustarAgua saldos={SALDOS} />)

    expect(screen.queryByText(/El tanque queda en/)).not.toBeInTheDocument()
  })

  /*
   * Un signo invertido es fácil de tipear y difícil de descubrir después: el
   * saldo queda mal y nadie lo nota hasta que no cuadra el mes.
   */
  it('sumar muestra a cuánto va a quedar', async () => {
    const usuario = userEvent.setup()
    render(<AjustarAgua saldos={SALDOS} />)

    await usuario.type(screen.getByRole('spinbutton', { name: /Diferencia/ }), '500')

    const aviso = screen.getByText(/El tanque queda en/)
    expect(aviso).toHaveTextContent('2.500')
    expect(aviso).toHaveTextContent('4.000')
  })

  it('restar también, y el número baja', async () => {
    const usuario = userEvent.setup()
    render(<AjustarAgua saldos={SALDOS} />)

    await usuario.type(screen.getByRole('spinbutton', { name: /Diferencia/ }), '-500')

    expect(screen.getByText(/El tanque queda en/)).toHaveTextContent('1.500')
  })

  it('un cero no adelanta nada: no ajusta nada', async () => {
    const usuario = userEvent.setup()
    render(<AjustarAgua saldos={SALDOS} />)

    await usuario.type(screen.getByRole('spinbutton', { name: /Diferencia/ }), '0')

    expect(screen.queryByText(/El tanque queda en/)).not.toBeInTheDocument()
  })

  it('el adelanto sigue al tanque elegido, no al primero de la lista', async () => {
    const usuario = userEvent.setup()
    render(<AjustarAgua saldos={SALDOS} />)

    await usuario.type(screen.getByRole('spinbutton', { name: /Diferencia/ }), '500')
    expect(screen.getByText(/El tanque queda en/)).toHaveTextContent('2.500')

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Tanque/ }), 'procesado')

    expect(screen.getByText(/El tanque queda en/)).toHaveTextContent('1.500')
  })

  it('el adelanto se anuncia para quien no lo ve', async () => {
    const usuario = userEvent.setup()
    render(<AjustarAgua saldos={SALDOS} />)

    await usuario.type(screen.getByRole('spinbutton', { name: /Diferencia/ }), '500')

    expect(screen.getByText(/El tanque queda en/)).toHaveAttribute('aria-live', 'polite')
  })

  /*
   * Un ajuste que nadie pueda explicar dentro de tres meses no sirve como
   * registro.
   */
  it('el motivo es obligatorio', () => {
    render(<AjustarAgua saldos={SALDOS} />)

    expect(screen.getByRole('textbox', { name: /Motivo/ })).toBeRequired()
  })

  it('el placeholder del motivo da un ejemplo real', () => {
    render(<AjustarAgua saldos={SALDOS} />)

    expect(screen.getByRole('textbox', { name: /Motivo/ })).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Llegó agua de la red'),
    )
  })

  it('sin saldos para ese tanque no inventa un adelanto', async () => {
    const usuario = userEvent.setup()
    render(<AjustarAgua saldos={[]} />)

    await usuario.type(screen.getByRole('spinbutton', { name: /Diferencia/ }), '500')

    expect(screen.queryByText(/El tanque queda en/)).not.toBeInTheDocument()
  })
})
