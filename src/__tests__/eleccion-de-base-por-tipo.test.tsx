import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SelectorDeBase } from '@/components/retornables/entrega-de-base'
import type { Base } from '@/lib/api-types'

/**
 * Elegir la base por TIPO y después por número — RN-BAS-14.
 *
 * El cliente pide «un dispensador», no «la 0913». Antes el desplegable
 * mezclaba los dos parques en una sola lista ordenada por número: para dar un
 * dispensador había que recorrer cuarenta estructuras leyendo la etiqueta de
 * cada una. La pregunta que el negocio hace primero es el tipo, así que esa es
 * la que la pantalla hace primero.
 */

const base = (id: string, idSticker: string, tipo: Base['tipo'], parcial: Partial<Base> = {}): Base =>
  ({
    id,
    idSticker,
    tipo,
    estado: 'sana',
    direccionId: null,
    ubicacion: null,
    danadaPor: null,
    danadaEn: null,
    recargoVentaId: null,
    activa: true,
    createdAt: '2026-10-14T00:00:00.000Z',
    ...parcial,
  }) as Base

const UNA_DE_CADA = [
  base('b-1', '0001', 'estructura'),
  base('b-2', '0002', 'estructura'),
  base('b-3', '0051', 'dispensador'),
]

describe('primero el tipo, después el número', () => {
  it('con los dos parques en bodega pregunta el tipo, y todavía no ofrece ningún número', () => {
    render(<SelectorDeBase bases={UNA_DE_CADA} name="baseId" identificarPor="id" />)

    expect(screen.getByLabelText('Qué tipo de base')).toBeInTheDocument()
    /*
     * El número NO se pregunta antes que el tipo. Ofrecer las cuarenta y tres
     * de una vez es exactamente el problema que esto vino a resolver.
     */
    expect(screen.queryByLabelText('Cuál base')).not.toBeInTheDocument()
  })

  it('elegido «dispensador», solo ofrece dispensadores', async () => {
    const usuario = userEvent.setup()
    render(<SelectorDeBase bases={UNA_DE_CADA} name="baseId" identificarPor="id" />)

    await usuario.selectOptions(screen.getByLabelText('Qué tipo de base'), 'dispensador')

    expect(screen.getByRole('option', { name: '0051' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '0001' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '0002' })).not.toBeInTheDocument()
  })

  it('con un solo tipo en bodega no pregunta el tipo: es una pregunta que no existe', () => {
    render(
      <SelectorDeBase
        bases={[base('b-1', '0001', 'estructura'), base('b-2', '0002', 'estructura')]}
        name="baseId"
        identificarPor="id"
      />,
    )

    expect(screen.queryByLabelText('Qué tipo de base')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cuál base')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '0001' })).toBeInTheDocument()
  })

  it('un tipo sin ninguna base libre no se ofrece: prometería algo que no hay', () => {
    render(
      <SelectorDeBase
        bases={[
          base('b-1', '0001', 'estructura'),
          base('b-3', '0051', 'dispensador', { direccionId: 'dir-1' }),
        ]}
        name="baseId"
        identificarPor="id"
      />,
    )

    // Queda un solo tipo con stock, así que ni siquiera pregunta.
    expect(screen.queryByLabelText('Qué tipo de base')).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '0051' })).not.toBeInTheDocument()
  })
})

describe('solo lo que el servidor va a aceptar', () => {
  it('no ofrece una base prestada: está en un solo lugar', async () => {
    const usuario = userEvent.setup()
    render(
      <SelectorDeBase
        bases={[
          base('b-1', '0001', 'estructura'),
          base('b-3', '0051', 'dispensador'),
          base('b-4', '0052', 'dispensador', { direccionId: 'dir-1' }),
        ]}
        name="baseId"
        identificarPor="id"
      />,
    )

    await usuario.selectOptions(screen.getByLabelText('Qué tipo de base'), 'dispensador')

    expect(screen.getByRole('option', { name: '0051' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '0052' })).not.toBeInTheDocument()
  })

  it('no ofrece una base dañada: el próximo cliente respondería por un daño ya cobrado', async () => {
    const usuario = userEvent.setup()
    render(
      <SelectorDeBase
        bases={[
          base('b-1', '0001', 'estructura'),
          base('b-3', '0051', 'dispensador'),
          base('b-5', '0053', 'dispensador', { estado: 'danada' }),
        ]}
        name="baseId"
        identificarPor="id"
      />,
    )

    await usuario.selectOptions(screen.getByLabelText('Qué tipo de base'), 'dispensador')

    expect(screen.queryByRole('option', { name: '0053' })).not.toBeInTheDocument()
  })
})

/**
 * Los dos formularios identifican la base distinto, y `api/` manda.
 *
 * La venta la busca por el STICKER —«en el mostrador nadie conoce el uuid»— y
 * el préstamo de Retornables por el id. El desplegable es el mismo; lo que
 * viaja, no. Si esto se equivoca, el servidor rechaza con un código que no
 * existe y nadie entiende por qué.
 */
describe('qué viaja en el formulario', () => {
  it('en Retornables viaja el id', async () => {
    const usuario = userEvent.setup()
    render(<SelectorDeBase bases={UNA_DE_CADA} name="baseId" identificarPor="id" />)

    await usuario.selectOptions(screen.getByLabelText('Qué tipo de base'), 'dispensador')
    const select = screen.getByLabelText('Cuál base') as HTMLSelectElement

    expect(select.name).toBe('baseId')
    expect(select.value).toBe('b-3')
  })

  it('en el mostrador viaja el sticker, que es lo que api espera', async () => {
    const usuario = userEvent.setup()
    render(
      <SelectorDeBase bases={UNA_DE_CADA} name="baseSticker" identificarPor="idSticker" />,
    )

    await usuario.selectOptions(screen.getByLabelText('Qué tipo de base'), 'dispensador')
    const select = screen.getByLabelText('Cuál base') as HTMLSelectElement

    expect(select.name).toBe('baseSticker')
    expect(select.value).toBe('0051')
  })
})

describe('cambiar de tipo no deja elegido un número del tipo anterior', () => {
  /*
   * La peor equivocación posible acá: elegir «estructura 0001», cambiar a
   * «dispensador» y que el formulario siga mandando la 0001. Se entregaría el
   * activo equivocado con el papel correcto.
   */
  it('al cambiar el tipo, lo elegido deja de valer', async () => {
    const usuario = userEvent.setup()
    render(<SelectorDeBase bases={UNA_DE_CADA} name="baseId" identificarPor="id" />)

    const tipo = screen.getByLabelText('Qué tipo de base')

    await usuario.selectOptions(tipo, 'estructura')
    await usuario.selectOptions(screen.getByLabelText('Cuál base'), 'b-2')
    expect((screen.getByLabelText('Cuál base') as HTMLSelectElement).value).toBe('b-2')

    await usuario.selectOptions(tipo, 'dispensador')

    // Con un solo dispensador libre, es ESE: preguntar entre uno no es preguntar.
    expect((screen.getByLabelText('Cuál base') as HTMLSelectElement).value).toBe('b-3')
  })
})
