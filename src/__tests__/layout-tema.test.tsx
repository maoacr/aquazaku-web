import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import RootLayout from '@/app/layout'
import type { Tema } from '@/lib/tema'

/**
 * `next/font/google` es una transformación de build, no una función real: fuera
 * de Next devuelve `undefined` y el layout revienta al importarse.
 */
vi.mock('next/font/google', () => {
  const fuente = (opciones: { variable: string }) => ({
    variable: opciones.variable,
    className: opciones.variable,
  })
  return { IBM_Plex_Sans: fuente, IBM_Plex_Mono: fuente }
})

const leerTemaMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/tema', async (original) => ({
  ...(await original<typeof import('@/lib/tema')>()),
  leerTema: leerTemaMock,
}))

/**
 * Que el layout USE el tema, no solo que las funciones existan.
 *
 * Este archivo nació de un experimento: se quitó `{...atributoDeTema(tema)}`
 * del layout y **los 265 tests siguieron en verde**. Las funciones estaban
 * probadas, el CSS estaba probado, y la funcionalidad completa podía estar
 * desconectada sin que nada lo notara.
 *
 * Es la misma costura donde vivieron los dos peores bugs de M0: entre "la pieza
 * funciona" y "alguien la llama".
 *
 * Se inspecciona el árbol que devuelve el layout en vez de renderizarlo: el
 * componente devuelve `<html>` y montarlo dentro de otro `<html>` produce ruido
 * que no aporta.
 */
async function htmlDelLayout(tema: Tema): Promise<Record<string, unknown>> {
  leerTemaMock.mockResolvedValue(tema)

  const arbol = (await RootLayout({
    children: null,
    params: Promise.resolve({}),
  })) as ReactElement<Record<string, unknown>>

  return arbol.props
}

describe('el layout pinta el tema en el <html>', () => {
  it('con oscuro escribe data-tema="oscuro"', async () => {
    expect(await htmlDelLayout('oscuro')).toMatchObject({ 'data-tema': 'oscuro' })
  })

  it('con claro escribe data-tema="claro", que es lo que le gana al sistema', async () => {
    expect(await htmlDelLayout('claro')).toMatchObject({ 'data-tema': 'claro' })
  })

  it('con sistema NO escribe el atributo: deja decidir a prefers-color-scheme', async () => {
    expect(await htmlDelLayout('sistema')).not.toHaveProperty('data-tema')
  })

  it('lee la preferencia en el servidor: sin eso habría destello', async () => {
    await htmlDelLayout('oscuro')

    // Si esto no se llama, el tema se resolvería en el cliente y la primera
    // pintura sería clara.
    expect(leerTemaMock).toHaveBeenCalled()
  })

  it('conserva el idioma y las variables de fuente', async () => {
    const props = await htmlDelLayout('oscuro')

    expect(props.lang).toBe('es')
    expect(String(props.className)).toContain('plex')
  })
})
