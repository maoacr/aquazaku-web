import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AjusteDeLote,
  DescarteDeLote,
  EntradaDeInventario,
} from '@/components/stock/formularios'
import type { LoteConSaldo, ResumenDeStock } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/stock/actions', () => ({
  registrarEntradaAction: vi.fn(async () => ({})),
  ajustarLoteAction: vi.fn(async () => ({})),
  descartarAction: vi.fn(async () => ({})),
}))

vi.mock('sileo', () => ({ sileo: { success: vi.fn(), warning: vi.fn() } }))

/**
 * Los tres formularios de stock — M2.
 *
 * ── El contador de motivo se muestra SIEMPRE ────────────────────────────────
 *
 * No solo cuando falta. Enterarse del mínimo al ser rechazado obliga a
 * reescribir lo que ya se pensó, y el motivo es justamente el campo donde más
 * duele que pase: es lo único que va a explicar el movimiento dentro de tres
 * meses.
 *
 * ── El código y el vencimiento NO se escriben ───────────────────────────────
 *
 * Los genera el sistema a partir de la fecha de empaque. Un lote con código
 * escrito a mano es un lote que se puede duplicar, y el FEFO dejaría de poder
 * ordenar por vencimiento.
 */

function lote(over: Partial<LoteConSaldo> = {}): LoteConSaldo {
  return {
    id: 'lot-1',
    codigo: '2026-09-18-L1',
    saldo: 120,
    fechaEmpaque: '2026-09-18',
    fechaVencimiento: '2026-10-18',
    ...over,
  }
}

function producto(over: Partial<ResumenDeStock> = {}): ResumenDeStock {
  return {
    productoId: 'prod-1',
    codigo: 'BOT20',
    nombre: 'Botellón 20L',
    activo: true,
    total: 120,
    vendible: 120,
    ...over,
  } as ResumenDeStock
}

function motivo(): HTMLElement {
  return screen.getByRole('textbox', { name: /Motivo/ })
}

describe('el contador de motivo, que está en los tres formularios', () => {
  it('arranca pidiendo los diez caracteres, sin que nadie escriba nada', () => {
    render(<AjusteDeLote lotes={[lote()]} />)

    expect(screen.getByText(/Faltan 10 caracteres/)).toBeInTheDocument()
  })

  it('baja mientras se escribe', async () => {
    const usuario = userEvent.setup()
    render(<AjusteDeLote lotes={[lote()]} />)

    await usuario.type(motivo(), 'conteo')

    expect(screen.getByText(/Faltan 4 caracteres/)).toBeInTheDocument()
  })

  it('al llegar al mínimo dice «Suficiente.» y deja de contar', async () => {
    const usuario = userEvent.setup()
    render(<AjusteDeLote lotes={[lote()]} />)

    await usuario.type(motivo(), 'conteo del lunes')

    expect(screen.queryByText(/Faltan/)).not.toBeInTheDocument()
    expect(screen.getByText('Suficiente.')).toBeInTheDocument()
  })

  /*
   * Diez espacios son un motivo vacío que pasó el contador, y esa fila de la
   * auditoría quedaría en blanco justo cuando alguien la vaya a leer.
   */
  it('los espacios no cuentan para el mínimo', async () => {
    const usuario = userEvent.setup()
    render(<AjusteDeLote lotes={[lote()]} />)

    await usuario.type(motivo(), '          ')

    expect(screen.getByText(/Faltan 10 caracteres/)).toBeInTheDocument()
  })

  it('el placeholder da un ejemplo concreto, no una instrucción', () => {
    render(<AjusteDeLote lotes={[lote()]} />)

    expect(motivo()).toHaveAttribute('placeholder', expect.stringContaining('conteo físico'))
  })
})

describe('EntradaDeInventario', () => {
  it('aclara que el código y el vencimiento los genera el sistema', () => {
    render(<EntradaDeInventario productos={[producto()]} />)

    expect(screen.getByText(/no se escriben/)).toBeInTheDocument()
  })

  it('no ofrece campo para el código de lote: no hay dónde escribirlo', () => {
    render(<EntradaDeInventario productos={[producto()]} />)

    expect(screen.queryByLabelText(/Código/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Vencimiento/)).not.toBeInTheDocument()
  })

  /*
   * La fecha de empaque arranca en hoy porque el caso normal es registrar lo
   * que acaba de salir de la envasadora. Dejarla vacía obliga a tipear una
   * fecha que casi siempre es la de hoy.
   */
  it('la fecha de empaque arranca en hoy', () => {
    render(<EntradaDeInventario productos={[producto()]} />)

    const hoy = new Date().toISOString().slice(0, 10)
    expect(screen.getByLabelText(/Fecha de empaque/)).toHaveValue(hoy)
  })

  it('el producto se nombra con su código', () => {
    render(<EntradaDeInventario productos={[producto()]} />)

    expect(screen.getByRole('option', { name: 'BOT20 — Botellón 20L' })).toBeInTheDocument()
  })

  it('las unidades piden teclado numérico: un teléfono abriría el alfabético', () => {
    render(<EntradaDeInventario productos={[producto()]} />)

    expect(screen.getByRole('spinbutton', { name: /Unidades/ })).toHaveAttribute(
      'inputmode',
      'numeric',
    )
  })

  it('no se puede registrar una entrada de cero unidades', () => {
    render(<EntradaDeInventario productos={[producto()]} />)

    expect(screen.getByRole('spinbutton', { name: /Unidades/ })).toHaveAttribute('min', '1')
  })
})

describe('AjusteDeLote', () => {
  /*
   * El ajuste acepta negativos porque el conteo físico puede dar menos. El
   * placeholder lo dice con un ejemplo en vez de explicarlo.
   */
  it('la diferencia admite negativos, y el ejemplo lo muestra', () => {
    render(<AjusteDeLote lotes={[lote()]} />)

    const campo = screen.getByRole('spinbutton', { name: /Diferencia/ })
    expect(campo).toHaveAttribute('placeholder', '-8')
    expect(campo).not.toHaveAttribute('min')
  })

  /*
   * El lote se elige con su saldo y su vencimiento a la vista: sin eso hay que
   * memorizar códigos para saber cuál se está por ajustar.
   */
  it('el lote se nombra con su saldo y su vencimiento, no solo con el código', () => {
    render(<AjusteDeLote lotes={[lote()]} />)

    expect(
      screen.getByRole('option', { name: '2026-09-18-L1 — 120 unidades — vence 2026-10-18' }),
    ).toBeInTheDocument()
  })

  it('obliga a elegir un lote: no hay uno por defecto', () => {
    render(<AjusteDeLote lotes={[lote()]} />)

    expect(screen.getByRole('combobox', { name: /Lote/ })).toHaveValue('')
  })
})

/**
 * El descarte.
 *
 * Las otras tres causas ya dicen qué pasó. «Otro» no dice nada, así que el
 * campo aparece y pasa a pedir el mismo mínimo que un motivo.
 */
describe('DescarteDeLote — la causa decide qué se pide', () => {
  function causa(): HTMLElement {
    return screen.getByRole('combobox', { name: /Causa/ })
  }

  it('aclara que descartar no destruye el lote entero', () => {
    render(<DescarteDeLote lotes={[lote()]} />)

    expect(screen.getByText(/no destruye el lote entero/)).toBeInTheDocument()
  })

  it('sin causa elegida, las observaciones son opcionales', () => {
    render(<DescarteDeLote lotes={[lote()]} />)

    expect(screen.getByText(/\(opcional\)/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Qué pasó/ })).not.toBeInTheDocument()
  })

  it.each(['falla_produccion', 'mal_manejo_cliente', 'vencido'])(
    'la causa %s deja las observaciones opcionales: ya dice qué pasó',
    async (valor) => {
      const usuario = userEvent.setup()
      render(<DescarteDeLote lotes={[lote()]} />)

      await usuario.selectOptions(causa(), valor)

      expect(screen.queryByRole('textbox', { name: /Qué pasó/ })).not.toBeInTheDocument()
      expect(screen.getByText(/\(opcional\)/)).toBeInTheDocument()
    },
  )

  it('«otro» cambia el campo por uno que exige explicar, con su contador', async () => {
    const usuario = userEvent.setup()
    render(<DescarteDeLote lotes={[lote()]} />)

    await usuario.selectOptions(causa(), 'otro')

    expect(screen.getByRole('textbox', { name: /Qué pasó/ })).toBeInTheDocument()
    expect(screen.getByText(/Faltan 10 caracteres/)).toBeInTheDocument()
    expect(screen.queryByText(/\(opcional\)/)).not.toBeInTheDocument()
  })

  it('el campo de «otro» sigue mandándose como observaciones', async () => {
    const usuario = userEvent.setup()
    render(<DescarteDeLote lotes={[lote()]} />)

    await usuario.selectOptions(causa(), 'otro')

    expect(screen.getByRole('textbox', { name: /Qué pasó/ })).toHaveAttribute(
      'name',
      'observaciones',
    )
  })

  it('volver a otra causa devuelve el campo opcional', async () => {
    const usuario = userEvent.setup()
    render(<DescarteDeLote lotes={[lote()]} />)

    await usuario.selectOptions(causa(), 'otro')
    await usuario.selectOptions(causa(), 'vencido')

    expect(screen.queryByRole('textbox', { name: /Qué pasó/ })).not.toBeInTheDocument()
  })

  it('el botón de descartar es destructivo: no se aprieta sin querer', () => {
    render(<DescarteDeLote lotes={[lote()]} />)

    expect(screen.getByRole('button', { name: /Registrar descarte/ })).toHaveClass(
      'aq-boton-destructivo',
    )
  })
})
