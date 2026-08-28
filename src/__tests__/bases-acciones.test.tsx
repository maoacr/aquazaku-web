import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListaDeBases } from '@/components/retornables/bases'
import type { Base, Cliente, Direccion } from '@/lib/api-types'

/**
 * Qué se le ofrece hacer a una base, según dónde esté — RN-BAS-04, 06 y 08.
 *
 * ── La UI solo ofrece lo que el servidor va a aceptar ───────────────────────
 *
 * El daño se le cobra a **quien la tiene**: una base en la bodega no tiene a
 * quién cobrarle, y el servidor la rechaza con `BASE_EN_BODEGA`. El descarte va
 * al revés: descartar una prestada dejaría un préstamo abierto sobre algo que ya
 * no existe (`BASE_PRESTADA`).
 *
 * Mostrar el botón igual y dejar que el servidor rechace sería prometer una
 * operación que no se puede hacer. Eso no reemplaza la validación del servidor
 * —RN-ACC-02: la UI oculta, la API prohíbe— sino que evita el viaje.
 *
 * Este test existe porque la condición es fácil de invertir y el error solo se
 * nota con una base en el estado contrario.
 */

const DIRECCION: Direccion & { cliente: Cliente } = {
  id: 'dir-1',
  clienteId: 'cli-1',
  etiqueta: 'El local',
  direccion: 'Calle 30 #12-45',
  indicaciones: null,
  activa: true,
  createdAt: '2026-08-27T12:00:00.000Z',
  cliente: {
    id: 'cli-1',
    nombre: 'Panadería del Centro',
  } as Cliente,
}

const base = (extra: Partial<Base> = {}): Base =>
  ({
    id: 'base-1',
    idSticker: '0913',
    estado: 'sana',
    direccionId: null,
    activa: true,
    danadaPor: null,
    danadaEn: null,
    recargoVentaId: null,
    createdAt: '2026-08-27T12:00:00.000Z',
    ...extra,
  }) as Base

const pintar = (b: Base) => render(<ListaDeBases bases={[b]} direcciones={[DIRECCION]} />)

describe('una base EN LA BODEGA', () => {
  it('se puede descartar, y no dañar: no hay a quién cobrarle', () => {
    pintar(base())

    expect(screen.getByText('Descartar')).toBeTruthy()
    expect(screen.queryByText('Se rompió')).toBeNull()
  })

  it('no ofrece devolverla: ya está acá', () => {
    pintar(base())

    expect(screen.queryByText('Volvió a la bodega')).toBeNull()
  })
})

describe('una base PRESTADA', () => {
  it('se puede devolver y dañar, pero no descartar', () => {
    pintar(base({ direccionId: 'dir-1' }))

    expect(screen.getByText('Volvió a la bodega')).toBeTruthy()
    expect(screen.getByText('Se rompió')).toBeTruthy()
    expect(screen.queryByText('Descartar')).toBeNull()
  })

  /*
   * Un daño ya generó un recargo. Volver a marcarla le cobraría dos veces al
   * cliente por la misma base rota — el servidor lo rechaza con `YA_DANADA`, y
   * la pantalla no tiene por qué ofrecerlo.
   */
  it('si ya está dañada, no se vuelve a dañar', () => {
    pintar(base({ direccionId: 'dir-1', estado: 'danada' }))

    expect(screen.queryByText('Se rompió')).toBeNull()
    expect(screen.getByText('Volvió a la bodega')).toBeTruthy()
  })
})

describe('el historial', () => {
  it('está siempre, sin importar dónde esté la base', () => {
    for (const b of [base(), base({ direccionId: 'dir-1' })]) {
      const { unmount } = pintar(b)

      expect(screen.getByText('Historial').getAttribute('href')).toBe(
        '/modulos/retornables/bases/base-1',
      )

      unmount()
    }
  })
})

describe('dónde está la base', () => {
  /*
   * La DIRECCIÓN, no el cliente. La pregunta que se hace quien sale con la moto
   * es «¿a cuál de sus tres locales voy a buscar la 0913?» — RN-BAS-03.
   */
  it('prestada muestra la dirección concreta', () => {
    pintar(base({ direccionId: 'dir-1' }))

    expect(screen.getByText(/Calle 30 #12-45/)).toBeTruthy()
  })
})
