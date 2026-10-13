import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AvisoDeBases } from '@/components/retornables/aviso-de-bases'
import { DarDeAltaBase, ListaDeBases, PrestarBase } from '@/components/retornables/bases'
import { darDeAltaBaseAction } from '@/app/(app)/modulos/retornables/actions'
import type { Base, DisponibilidadDeBases } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/retornables/actions', () => ({
  darDeAltaBaseAction: vi.fn(),
  comprarBasesAction: vi.fn(),
  prestarBaseAction: vi.fn(),
  retornarBaseAction: vi.fn(),
  descartarBaseAction: vi.fn(),
  marcarBaseDanadaAction: vi.fn(),
}))

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  direccionesDeClienteAction: vi.fn(),
}))

/**
 * Dos tipos de base en la pantalla — RN-BAS-14.
 */

const base = (id: string, idSticker: string, tipo: Base['tipo']): Base =>
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
    createdAt: '2026-10-13T00:00:00.000Z',
  }) as Base

const disponibilidad = (
  tipo: DisponibilidadDeBases['tipo'],
  libres: number,
  alcanza: boolean,
): DisponibilidadDeBases => ({
  tipo,
  libres,
  prestadasEnLaVentana: alcanza ? 0 : 4,
  diasDeEntrega: 7,
  alcanza,
})

/**
 * ── La que más importa de este archivo ──────────────────────────────────────
 *
 * React 19 resetea el formulario cuando una acción termina, y no distingue el
 * éxito del error: un `<select>` no controlado vuelve a su default. El tipo
 * acompaña a la base hasta su descarte, así que un «dispensador» que se
 * convierte en «estructura» por un error de sticker duplicado queda escrito
 * para siempre, y solo se descubre yendo a mirar el objeto.
 *
 * Mismo mecanismo que `form-reset-al-fallar.test.tsx` probó para la dirección
 * de una venta. Acá la consecuencia es peor: una venta mal dirigida se anula,
 * un tipo mal puesto no se corrige sin descartar la base y perder su historial.
 */
describe('un alta rechazada no debe borrar el tipo elegido', () => {
  it('el select conserva «dispensador» después del error', async () => {
    vi.mocked(darDeAltaBaseAction).mockResolvedValue({
      error: 'ya hay una base con el sticker 0913',
    })

    const usuario = userEvent.setup()
    render(<DarDeAltaBase proximo="0913" />)

    const tipo = screen.getByRole('combobox', { name: /tipo de base/i }) as HTMLSelectElement

    /*
     * «dispensador» NO es la primera opción: con la primera, un reset al
     * default sería indistinguible de no haber reseteado nada y el test pasaría
     * por la razón equivocada.
     */
    await usuario.selectOptions(tipo, 'dispensador')
    expect(tipo.value).toBe('dispensador')

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    expect(await screen.findByText(/ya hay una base con el sticker/)).toBeInTheDocument()
    expect(
      (screen.getByRole('combobox', { name: /tipo de base/i }) as HTMLSelectElement).value,
    ).toBe('dispensador')
  })

  it('arranca sin tipo elegido: no hay valor por omisión en ninguna capa', () => {
    render(<DarDeAltaBase proximo="0913" />)

    expect((screen.getByRole('combobox', { name: /tipo de base/i }) as HTMLSelectElement).value).toBe(
      '',
    )
  })
})

describe('la lista dice de qué tipo es cada base', () => {
  it('muestra el tipo junto al sticker', () => {
    render(
      <ListaDeBases
        bases={[base('b-1', '0001', 'estructura'), base('b-2', '0002', 'dispensador')]}
      />,
    )

    expect(screen.getByText('Estructura')).toBeInTheDocument()
    expect(screen.getByText('Dispensador')).toBeInTheDocument()
  })
})

describe('el desplegable de prestar dice el tipo de cada base', () => {
  /*
   * El cliente pide «un dispensador», no «la 0913». Sin el tipo en la opción,
   * elegir bien depende de acordarse de cuál era cuál.
   */
  it('cada opción lleva el número y el tipo', () => {
    render(
      <PrestarBase
        bases={[base('b-1', '0001', 'estructura'), base('b-2', '0002', 'dispensador')]}
      />,
    )

    expect(screen.getByRole('option', { name: '0002 — Dispensador' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '0001 — Estructura' })).toBeInTheDocument()
  })
})

/**
 * El aviso de compra, por tipo — RN-BAS-13 y RN-BAS-14.
 *
 * El caso que hace falta la regla: hay estructuras de sobra y no queda ningún
 * dispensador. Un solo cartel sumando los dos parques diría que alcanza.
 */
describe('el aviso de compra separa los dos parques', () => {
  it('avisa del dispensador aunque las estructuras alcancen', () => {
    render(
      <AvisoDeBases
        disponibilidad={[
          disponibilidad('estructura', 20, true),
          disponibilidad('dispensador', 0, false),
        ]}
        hayBases
      />,
    )

    const avisos = screen.getAllByRole('status')

    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toHaveTextContent(/No queda ningún dispensador para prestar/)
  })

  it('con los dos parques cortos, avisa dos veces y nombra cada uno', () => {
    render(
      <AvisoDeBases
        disponibilidad={[
          disponibilidad('estructura', 1, false),
          disponibilidad('dispensador', 0, false),
        ]}
        hayBases
      />,
    )

    const avisos = screen.getAllByRole('status')

    expect(avisos).toHaveLength(2)
    expect(avisos[0]).toHaveTextContent(/Queda 1 estructura para prestar/)
    expect(avisos[1]).toHaveTextContent(/No queda ningún dispensador para prestar/)
  })

  it('si los dos alcanzan, no hay cartel: el sistema no felicita', () => {
    render(
      <AvisoDeBases
        disponibilidad={[
          disponibilidad('estructura', 20, true),
          disponibilidad('dispensador', 5, true),
        ]}
        hayBases
      />,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
