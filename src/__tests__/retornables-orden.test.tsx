import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RetornablesPage from '@/app/(app)/modulos/retornables/page'
import type { Base } from '@/lib/api-types'

vi.mock('@/lib/api-server', () => ({
  getServerUser: vi.fn(async () => ({ name: 'Ana Gómez', roles: ['admin'], permisos: [] })),
  apiServerFetch: vi.fn(),
}))

/* Las once acciones del módulo. Si falta una, el render se cae y lo dice. */
vi.mock('@/app/(app)/modulos/retornables/actions', () => ({
  ajustarBotellonesAction: vi.fn(),
  buscarBaseParaPrestarAction: vi.fn(),
  comprarBasesAction: vi.fn(),
  comprarBotellonesAction: vi.fn(),
  darDeAltaBaseAction: vi.fn(),
  descartarBaseAction: vi.fn(),
  descartarBotellonesAction: vi.fn(),
  entregarBotellonesAction: vi.fn(),
  marcarBaseDanadaAction: vi.fn(),
  prestarBaseAction: vi.fn(),
  retornarBaseAction: vi.fn(),
}))

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  direccionesDeClienteAction: vi.fn(),
}))

const { apiServerFetch } = await import('@/lib/api-server')

/**
 * Dónde caen los formularios de bases dentro de Retornables.
 *
 * ── La queja ────────────────────────────────────────────────────────────────
 *
 * Aquazaku abrió esta pantalla a registrar un dispensador y **no encontró
 * dónde**. «Comprar bases» y «Dar de alta una base» estaban después de la lista
 * completa del parque: con cuarenta bases son catorce filas de tarjetas de
 * scroll entre la última acción y el formulario.
 *
 * ── Por qué se mide el ORDEN y no la posición ───────────────────────────────
 *
 * jsdom no hace layout: acá todo mide cero y no hay scroll que comprobar. Lo
 * que sí determina a qué distancia cae un formulario en una pantalla real es su
 * lugar en el documento, y eso es lo que se fija. Mismo criterio que
 * `form-reset-al-fallar.test.tsx` usa para el mensaje de error del mostrador.
 *
 * ── Lo que NO cambió ────────────────────────────────────────────────────────
 *
 * El orden de la sección sigue siendo «estado → lo diario → lo ocasional».
 * Comprar y dar de alta siguen siendo lo ocasional, y siguen DESPUÉS de
 * prestar. Lo que se movió es la lista, que no es una acción.
 */

const base = (id: string, idSticker: string): Base =>
  ({
    id,
    idSticker,
    tipo: 'estructura',
    estado: 'sana',
    direccionId: null,
    ubicacion: null,
    danadaPor: null,
    danadaEn: null,
    recargoVentaId: null,
    activa: true,
    createdAt: '2026-10-13T00:00:00.000Z',
  }) as Base

function conParque(cuantas: number) {
  const bases = Array.from({ length: cuantas }, (_, i) =>
    base(`b-${i}`, String(i + 1).padStart(4, '0')),
  )

  vi.mocked(apiServerFetch).mockImplementation(async (url: string) => {
    if (url === '/botellones')
      return {
        enBodega: 100,
        enPoderDeAlguien: 120,
        registrados: 120,
        cuadra: true,
        diferencia: 0,
      }
    if (url === '/bases') return bases
    if (url === '/bases/proximo-codigo') return { proximo: '0041' }
    if (url === '/bases/disponibilidad')
      return [
        { tipo: 'estructura', libres: cuantas, prestadasEnLaVentana: 0, diasDeEntrega: 7, alcanza: true },
      ]
    throw new Error(`ruta no mockeada: ${url}`)
  })
}

/** El índice de un encabezado dentro del documento, para comparar posiciones. */
function posicionDe(texto: RegExp): number {
  const nodo = screen.getByRole('heading', { name: texto })
  const todos = Array.from(document.querySelectorAll('h2, h3, ul'))
  return todos.indexOf(nodo as Element)
}

describe('los formularios de bases se alcanzan sin atravesar el parque', () => {
  it('comprar y dar de alta van ANTES de la lista', async () => {
    conParque(40)

    render(await RetornablesPage())

    const comprar = posicionDe(/Entraron bases nuevas/i)
    const alta = posicionDe(/Dar de alta una base/i)
    const lista = Array.from(document.querySelectorAll('h2, h3, ul')).findIndex(
      (n) => n.tagName === 'UL' && n.querySelectorAll('article').length === 40,
    )

    expect(comprar).toBeGreaterThan(-1)
    expect(alta).toBeGreaterThan(-1)
    expect(lista).toBeGreaterThan(-1)

    expect(comprar).toBeLessThan(lista)
    expect(alta).toBeLessThan(lista)
  })

  /*
   * Y lo ocasional sigue después de lo diario: prestar es la acción de todos los
   * días y conserva su lugar. Si alguien «arregla» esto subiendo los
   * formularios hasta arriba, el principio de la sección se rompe y esto falla.
   */
  it('pero siguen después de prestar, que es lo de todos los días', async () => {
    conParque(40)

    render(await RetornablesPage())

    expect(posicionDe(/Prestar una base/i)).toBeLessThan(posicionDe(/Entraron bases nuevas/i))
  })
})
