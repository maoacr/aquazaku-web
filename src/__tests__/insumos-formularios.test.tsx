import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AjusteDeInsumo,
  CargarEquivalencia,
  DescarteDeInsumo,
  EntradaDeInsumo,
} from '@/components/insumos/formularios'
import type { InsumoListado } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/insumos/actions', () => ({
  registrarEntradaAction: vi.fn(async () => ({})),
  ajustarInsumoAction: vi.fn(async () => ({})),
  descartarInsumoAction: vi.fn(async () => ({})),
  cargarEquivalenciaAction: vi.fn(async () => ({})),
}))

vi.mock('sileo', () => ({ sileo: { success: vi.fn(), warning: vi.fn() } }))

/**
 * Los cuatro formularios de la pantalla de insumos — M3.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que NO se convierta en silencio. Convertir sin mostrar es lo que hace que un
 * descuadre sea imposible de explicar tres meses después: quien carga 12 kg
 * tiene que ver «≈ 1.200 unidades» y poder decir «ese número no puede ser»
 * ANTES de escribirlo en el libro.
 *
 * Que el selector de kilos NO se ofrezca sin equivalencia. No es un permiso:
 * es que sin la medición no hay con qué convertir, y ofrecer el campo sería
 * prometer algo que va a fallar al enviar.
 *
 * Y que los campos que piden explicación aparezcan cuando hacen falta: `otro`
 * no dice nada por sí solo, y sin texto esa fila de la auditoría es ruido.
 */

function insumo(over: Partial<InsumoListado> = {}): InsumoListado {
  return {
    id: 'ins-1',
    codigo: 'TAP',
    nombre: 'Tapas',
    unidad: 'unidad',
    minimo: 100,
    saldo: 540,
    equivalenciaPorKilo: null,
    activo: true,
    bajoMinimo: false,
    ...over,
  }
}

const MEDIDO = insumo({ id: 'ins-1', codigo: 'TAP', nombre: 'Tapas', equivalenciaPorKilo: '450' })
const SIN_MEDIR = insumo({ id: 'ins-2', codigo: 'ETI', nombre: 'Etiquetas' })

function selector(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: /Insumo/ })
}

function comoSeCompro(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: /Se compró por/ })
}

describe('EntradaDeInsumo — la conversión se muestra antes de confirmar', () => {
  it('arranca sin insumo elegido y con el botón bloqueado', () => {
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    expect(selector()).toHaveValue('')
    expect(screen.getByRole('button', { name: /Registrar entrada/ })).toBeDisabled()
  })

  it('elegir un insumo habilita el botón', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(selector(), 'ins-1')

    expect(screen.getByRole('button', { name: /Registrar entrada/ })).toBeEnabled()
  })

  it('el desplegable nombra cada insumo con su código', () => {
    render(<EntradaDeInsumo insumos={[MEDIDO, SIN_MEDIR]} />)

    expect(screen.getByRole('option', { name: 'TAP — Tapas' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'ETI — Etiquetas' })).toBeInTheDocument()
  })

  /*
   * Sin equivalencia no hay con qué convertir. Dejar «Kilos» elegible sería
   * prometer una conversión que `api/` va a rechazar al enviar, después de que
   * la persona ya escribió todo.
   */
  it('sin equivalencia, kilos queda deshabilitado', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[SIN_MEDIR]} />)

    await usuario.selectOptions(selector(), 'ins-2')

    expect(comoSeCompro()).toBeDisabled()
  })

  it('con equivalencia, kilos se puede elegir', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(selector(), 'ins-1')

    expect(comoSeCompro()).toBeEnabled()
  })

  it('sin insumo elegido tampoco deja elegir la medida', () => {
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    expect(comoSeCompro()).toBeDisabled()
  })

  it('avisa por qué la compra va en unidades cuando falta la medición', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[SIN_MEDIR]} />)

    await usuario.selectOptions(selector(), 'ins-2')

    expect(screen.getByText(/Cargue la equivalencia abajo/)).toBeInTheDocument()
  })

  it('sin insumo elegido no muestra ese aviso: todavía no hay nada que decir', () => {
    render(<EntradaDeInsumo insumos={[SIN_MEDIR]} />)

    expect(screen.queryByText(/Cargue la equivalencia abajo/)).not.toBeInTheDocument()
  })

  /*
   * Se muestra el CÁLCULO completo, no solo el resultado: así se puede detectar
   * que la equivalencia está vieja sin abrir el movimiento.
   */
  it('en kilos muestra la cuenta entera: kilos × equivalencia = unidades', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(selector(), 'ins-1')
    await usuario.selectOptions(comoSeCompro(), 'kilo')
    await usuario.type(screen.getByRole('spinbutton', { name: /Kilos/ }), '12')

    const aviso = screen.getByText(/Van a entrar/)
    expect(aviso).toHaveTextContent('5.400')
    expect(aviso).toHaveTextContent('12')
    expect(aviso).toHaveTextContent('450')
  })

  it('redondea a unidades enteras: media tapa no existe', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[insumo({ equivalenciaPorKilo: '3' })]} />)

    await usuario.selectOptions(selector(), 'ins-1')
    await usuario.selectOptions(comoSeCompro(), 'kilo')
    await usuario.type(screen.getByRole('spinbutton', { name: /Kilos/ }), '2.5')

    expect(screen.getByText(/Van a entrar/)).toHaveTextContent('8')
  })

  it('en unidades no muestra ninguna conversión: no hay nada que convertir', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(selector(), 'ins-1')
    await usuario.type(screen.getByRole('spinbutton', { name: /Unidades/ }), '500')

    expect(screen.queryByText(/Van a entrar/)).not.toBeInTheDocument()
  })

  it('sin escribir la cantidad todavía no muestra la cuenta', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(selector(), 'ins-1')
    await usuario.selectOptions(comoSeCompro(), 'kilo')

    expect(screen.queryByText(/Van a entrar/)).not.toBeInTheDocument()
  })

  it('el campo cambia de nombre según la medida', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(selector(), 'ins-1')
    expect(screen.getByRole('spinbutton', { name: /Unidades/ })).toBeInTheDocument()

    await usuario.selectOptions(comoSeCompro(), 'kilo')
    expect(screen.getByRole('spinbutton', { name: /Kilos/ })).toBeInTheDocument()
  })

  /*
   * Al cambiar de insumo vuelve a unidades. El nuevo puede no tener
   * equivalencia, y dejar «kilos» seleccionado prometería convertir con un
   * número que no existe.
   */
  it('cambiar de insumo vuelve a unidades: el nuevo puede no estar medido', async () => {
    const usuario = userEvent.setup()
    render(<EntradaDeInsumo insumos={[MEDIDO, SIN_MEDIR]} />)

    await usuario.selectOptions(selector(), 'ins-1')
    await usuario.selectOptions(comoSeCompro(), 'kilo')
    expect(comoSeCompro()).toHaveValue('kilo')

    await usuario.selectOptions(selector(), 'ins-2')

    expect(comoSeCompro()).toHaveValue('unidad')
    expect(screen.queryByText(/Van a entrar/)).not.toBeInTheDocument()
  })
})

/**
 * El ajuste contra un conteo físico.
 *
 * El motivo tiene un mínimo de diez caracteres y el contador lo dice mientras
 * se escribe: descubrirlo recién al enviar castiga a quien ya pensó la
 * explicación.
 */
describe('AjusteDeInsumo — el motivo se cuenta mientras se escribe', () => {
  it('arranca pidiendo los diez caracteres', () => {
    render(<AjusteDeInsumo insumos={[MEDIDO]} />)

    expect(screen.getByText(/Faltan 10 caracteres/)).toBeInTheDocument()
  })

  it('el contador baja a medida que se escribe', async () => {
    const usuario = userEvent.setup()
    render(<AjusteDeInsumo insumos={[MEDIDO]} />)

    await usuario.type(screen.getByRole('textbox', { name: /Motivo/ }), 'conteo')

    expect(screen.getByText(/Faltan 4 caracteres/)).toBeInTheDocument()
  })

  it('a los diez deja de contar y dice dónde queda el registro', async () => {
    const usuario = userEvent.setup()
    render(<AjusteDeInsumo insumos={[MEDIDO]} />)

    await usuario.type(screen.getByRole('textbox', { name: /Motivo/ }), 'conteo del lunes')

    expect(screen.queryByText(/Faltan/)).not.toBeInTheDocument()
    expect(screen.getByText(/Queda en la auditoría/)).toBeInTheDocument()
  })

  /*
   * Los espacios no cuentan. Diez espacios son un motivo vacío que pasó el
   * contador, y la fila de auditoría quedaría en blanco.
   */
  it('los espacios no cuentan para el mínimo', async () => {
    const usuario = userEvent.setup()
    render(<AjusteDeInsumo insumos={[MEDIDO]} />)

    await usuario.type(screen.getByRole('textbox', { name: /Motivo/ }), '   conteo   ')

    expect(screen.getByText(/Faltan 4 caracteres/)).toBeInTheDocument()
  })

  it('sin insumo elegido no deja registrar', () => {
    render(<AjusteDeInsumo insumos={[MEDIDO]} />)

    expect(screen.getByRole('button', { name: /Registrar ajuste/ })).toBeDisabled()
  })

  it('la diferencia acepta negativos: el conteo puede dar menos', () => {
    render(<AjusteDeInsumo insumos={[MEDIDO]} />)

    expect(screen.getByRole('spinbutton', { name: /Diferencia/ })).toHaveAttribute(
      'placeholder',
      '-8',
    )
  })
})

/**
 * El descarte.
 *
 * `otro` no dice nada por sí solo: sin explicación, esa fila de la auditoría es
 * ruido dentro de tres meses. Por eso el campo aparece solo con esa causa.
 */
describe('DescarteDeInsumo — «otro» exige explicar', () => {
  it('sin causa elegida no pide explicación', () => {
    render(<DescarteDeInsumo insumos={[MEDIDO]} />)

    expect(screen.queryByRole('textbox', { name: /Qué pasó/ })).not.toBeInTheDocument()
  })

  it.each(['falla_produccion', 'mal_manejo_cliente', 'vencido'])(
    'la causa %s no pide explicación: ya dice qué pasó',
    async (causa) => {
      const usuario = userEvent.setup()
      render(<DescarteDeInsumo insumos={[MEDIDO]} />)

      await usuario.selectOptions(screen.getByRole('combobox', { name: /Causa/ }), causa)

      expect(screen.queryByRole('textbox', { name: /Qué pasó/ })).not.toBeInTheDocument()
    },
  )

  it('«otro» hace aparecer el campo de explicación', async () => {
    const usuario = userEvent.setup()
    render(<DescarteDeInsumo insumos={[MEDIDO]} />)

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Causa/ }), 'otro')

    expect(screen.getByRole('textbox', { name: /Qué pasó/ })).toBeRequired()
  })

  it('volver a otra causa lo esconde de nuevo', async () => {
    const usuario = userEvent.setup()
    render(<DescarteDeInsumo insumos={[MEDIDO]} />)

    const causa = screen.getByRole('combobox', { name: /Causa/ })
    await usuario.selectOptions(causa, 'otro')
    await usuario.selectOptions(causa, 'vencido')

    expect(screen.queryByRole('textbox', { name: /Qué pasó/ })).not.toBeInTheDocument()
  })

  it('el botón de descartar es destructivo, no primario', () => {
    render(<DescarteDeInsumo insumos={[MEDIDO]} />)

    expect(screen.getByRole('button', { name: /Registrar descarte/ })).toHaveClass(
      'aq-boton-destructivo',
    )
  })
})

/**
 * Cargar la equivalencia.
 *
 * Solo se ofrece para los insumos que NO la tienen. Es una medición que se hace
 * una vez, y ponerla junto a los ya medidos invitaría a «corregirla» sin haber
 * vuelto a pesar nada.
 */
describe('CargarEquivalencia — solo para lo que falta medir', () => {
  it('lista únicamente los insumos sin medir', () => {
    render(<CargarEquivalencia insumos={[MEDIDO, SIN_MEDIR]} />)

    expect(screen.getByRole('option', { name: 'ETI — Etiquetas' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'TAP — Tapas' })).not.toBeInTheDocument()
  })

  /*
   * Con todo medido el formulario no existe. Dejarlo vacío sería una tarjeta
   * que invita a hacer algo que no hay que hacer.
   */
  it('con todo medido no se dibuja nada', () => {
    const { container } = render(<CargarEquivalencia insumos={[MEDIDO]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('sin insumos tampoco', () => {
    const { container } = render(<CargarEquivalencia insumos={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('explica cómo se mide, no solo qué se pide', () => {
    render(<CargarEquivalencia insumos={[SIN_MEDIR]} />)

    expect(screen.getByText(/Pese un paquete/)).toBeInTheDocument()
  })

  it('aclara que sin el número la compra se rechaza en vez de estimarse', () => {
    render(<CargarEquivalencia insumos={[SIN_MEDIR]} />)

    expect(screen.getByText(/la rechaza en vez de estimar/)).toBeInTheDocument()
  })
})
