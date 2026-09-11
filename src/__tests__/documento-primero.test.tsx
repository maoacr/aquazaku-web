import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentoPrimero } from '@/components/clientes/documento-primero'
import type { Cliente } from '@/lib/api-types'

const buscarClientesAction = vi.fn()

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  buscarClientesAction: (documento: string) => buscarClientesAction(documento),
}))

/**
 * El documento va PRIMERO — M16.
 *
 * ── Por qué ────────────────────────────────────────────────────────────────
 *
 * Es el único dato que puede decir «este cliente ya existe», y hoy se pide
 * quinto: después de cuatro campos de nombre. Quien registra escribe todo, da
 * «Registrar», y **recién ahí** la base rechaza por documento repetido.
 *
 * El índice único `clientes_documento_idx` ya impide el duplicado — la
 * integridad no está en juego. Lo que está en juego es no hacer trabajar al
 * vicio.
 *
 * ── Dos casos que se parecen y no son lo mismo ──────────────────────────────
 *
 * · **Mismo tipo y mismo número** → ese cliente YA existe. No hay nada que
 *   registrar: hay que ir a su ficha.
 * · **Mismo número, otro tipo** → puede ser legítimo. El NIT de una persona
 *   natural se basa en su cédula (RN-CLI-08). Se avisa y se sigue.
 */

const cliente = (parcial: Partial<Cliente> = {}): Cliente =>
  ({
    id: 'c1',
    nombre: 'Rosa Elena Padilla Gómez',
    tipoDocumento: 'CC',
    numeroDocumento: '79123456',
    documento: 'CC 79123456',
    ...parcial,
  }) as Cliente

beforeEach(() => {
  buscarClientesAction.mockReset()
  buscarClientesAction.mockResolvedValue([])
})

async function escribir(texto: string) {
  const usuario = userEvent.setup()
  const campo = screen.getByRole('textbox', { name: /Número/ })

  await usuario.clear(campo)
  await usuario.type(campo, texto)
}

describe('antes de escribir lo suficiente', () => {
  it('no pregunta al servidor por uno o dos dígitos', async () => {
    render(<DocumentoPrimero />)
    await escribir('79')

    await new Promise((r) => setTimeout(r, 400))

    expect(buscarClientesAction).not.toHaveBeenCalled()
  })
})

describe('cuando ese documento ya existe', () => {
  beforeEach(() => {
    buscarClientesAction.mockResolvedValue([cliente()])
  })

  it('lo dice con el nombre de quien es', async () => {
    render(<DocumentoPrimero />)
    await escribir('79123456')

    expect(await screen.findByText(/Rosa Elena Padilla Gómez/)).toBeInTheDocument()
  })

  /*
   * El enlace a la ficha es lo que convierte el aviso en algo accionable. Sin
   * él, quien registra sabe que no puede seguir y no sabe a dónde ir.
   */
  it('ofrece ir a su ficha', async () => {
    render(<DocumentoPrimero />)
    await escribir('79123456')

    const enlace = await screen.findByRole('link', { name: /ficha|ver/i })
    expect(enlace).toHaveAttribute('href', '/modulos/clientes/c1')
  })

  it('avisa al formulario que no se puede seguir', async () => {
    const alCambiar = vi.fn()

    render(<DocumentoPrimero onEstado={alCambiar} />)
    await escribir('79123456')

    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith('tomado'))
  })
})

describe('el cruce CC/NIT, que no es lo mismo', () => {
  /*
   * RN-CLI-08: el NIT de una persona natural se basa en su cédula, así que el
   * mismo número con los dos tipos puede ser legítimo. No se bloquea: se avisa.
   */
  it('avisa pero deja seguir', async () => {
    buscarClientesAction.mockResolvedValue([cliente({ tipoDocumento: 'NIT' })])
    const alCambiar = vi.fn()

    render(<DocumentoPrimero onEstado={alCambiar} />)
    await escribir('79123456')

    expect(await screen.findByText(/NIT/)).toBeInTheDocument()
    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith('cruce'))
    expect(alCambiar).not.toHaveBeenCalledWith('tomado')
  })
})

describe('cuando está libre', () => {
  /*
   * El resultado bueno también se dice. Sin confirmación, quien escribe no sabe
   * si el sistema comprobó algo o si se quedó callado porque falló.
   */
  it('confirma que se puede usar', async () => {
    render(<DocumentoPrimero />)
    await escribir('79123456')

    expect(await screen.findByText(/libre|se puede/i)).toBeInTheDocument()
  })

  it('avisa al formulario que puede seguir', async () => {
    const alCambiar = vi.fn()

    render(<DocumentoPrimero onEstado={alCambiar} />)
    await escribir('79123456')

    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith('libre'))
  })
})

/**
 * La búsqueda por documento es por PREFIJO: tecleando `79123` vuelven todos los
 * que empiezan así. Un prefijo no es una coincidencia — si se tomara como tal,
 * el formulario bloquearía a quien todavía no terminó de escribir.
 */
describe('un prefijo no es el mismo documento', () => {
  it('no bloquea con una coincidencia parcial', async () => {
    buscarClientesAction.mockResolvedValue([cliente({ numeroDocumento: '79123456789' })])
    const alCambiar = vi.fn()

    render(<DocumentoPrimero onEstado={alCambiar} />)
    await escribir('79123456')

    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith('libre'))
    expect(alCambiar).not.toHaveBeenCalledWith('tomado')
  })
})
