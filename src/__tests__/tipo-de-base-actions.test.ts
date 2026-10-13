import { describe, expect, it, vi } from 'vitest'
import {
  comprarBasesAction,
  darDeAltaBaseAction,
} from '@/app/(app)/modulos/retornables/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')

/**
 * El tipo de base que VIAJA en el cuerpo — RN-BAS-14.
 *
 * ── Por qué se afirma el cuerpo y no el render ──────────────────────────────
 *
 * Lo que decide de qué tipo queda una base para toda su vida es el JSON que
 * sale de acá. Un test sobre la pantalla puede pasar con el desplegable
 * perfecto y un `body` que no lleva el campo — y el error solo aparecería en
 * producción, como una base mal tipeada que nadie puede corregir sin descartarla.
 *
 * ── Y por qué el tipo va CRUDO, sin default ─────────────────────────────────
 *
 * Si el campo viene vacío, lo que viaja es la cadena vacía y `api` responde 422
 * con el mensaje del dominio. Poner `?? 'estructura'` acá sería el cuarto lugar
 * donde alguien puede inventar un tipo, y el peor de todos: nadie lo vería.
 */

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function cuerpoEnviado(): Record<string, unknown> {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe('el alta de una base manda el tipo', () => {
  it('el tipo elegido llega a `api`', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(201, { idSticker: '0913', tipo: 'dispensador' }),
    )

    await darDeAltaBaseAction({}, form({ idSticker: '0913', tipo: 'dispensador' }))

    expect(cuerpoEnviado()).toEqual({ idSticker: '0913', tipo: 'dispensador' })
  })

  /*
   * El campo sin elegir viaja vacío a propósito. La alternativa —no mandar la
   * clave, o mandar 'estructura'— convertiría un olvido del formulario en una
   * estructura metálica permanente.
   */
  it('sin tipo elegido viaja vacío, y es `api` quien lo rechaza', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(422, { mensaje: 'hay que decir si es una estructura metálica o un dispensador' }),
    )

    const estado = await darDeAltaBaseAction({}, form({ idSticker: '0913' }))

    expect(cuerpoEnviado()).toEqual({ idSticker: '0913', tipo: '' })
    expect(estado.error).toMatch(/estructura metálica o un dispensador/)
  })
})

describe('la compra de bases manda el tipo', () => {
  it('la cantidad y el tipo van juntos', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(201, [
        { idSticker: '0041', tipo: 'dispensador' },
        { idSticker: '0042', tipo: 'dispensador' },
      ]),
    )

    await comprarBasesAction({}, form({ cantidad: '2', tipo: 'dispensador' }))

    expect(cuerpoEnviado()).toEqual({ cantidad: 2, tipo: 'dispensador' })
  })
})
