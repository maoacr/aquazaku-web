import { describe, expect, it, vi } from 'vitest'
import { atributoDeTema, esTemaValido, leerTema, TEMAS } from '@/lib/tema'

const cookieMock = vi.hoisted(() => vi.fn())
vi.mock('next/headers', () => ({ cookies: cookieMock }))

function conCookie(valor: string | undefined) {
  cookieMock.mockResolvedValue({ get: () => (valor === undefined ? undefined : { value: valor }) })
}

describe('esTemaValido()', () => {
  it.each(TEMAS)('acepta %s', (tema) => {
    expect(esTemaValido(tema)).toBe(true)
  })

  it.each(['azul', '', 'OSCURO', 'dark', null, undefined, 42, {}])(
    'rechaza %s: la cookie la escribe el cliente y no se le cree',
    (valor) => {
      expect(esTemaValido(valor)).toBe(false)
    },
  )
})

describe('leerTema()', () => {
  it.each(TEMAS)('devuelve %s cuando la cookie lo trae', async (tema) => {
    conCookie(tema)

    expect(await leerTema()).toBe(tema)
  })

  it('sin cookie devuelve sistema', async () => {
    conCookie(undefined)

    expect(await leerTema()).toBe('sistema')
  })

  /**
   * Un valor inválido NO es un error: alguien con una cookie vieja de otra
   * versión tiene que poder entrar igual. `sistema` es el default seguro —
   * seguir al sistema operativo nunca deja a nadie con una pantalla ilegible.
   */
  it.each(['azul', 'dark', 'OSCURO', ''])('normaliza %s a sistema en vez de fallar', async (basura) => {
    conCookie(basura)

    expect(await leerTema()).toBe('sistema')
  })
})

describe('atributoDeTema() — las tres ramas', () => {
  it('oscuro escribe el atributo que activa los tokens', () => {
    expect(atributoDeTema('oscuro')).toEqual({ 'data-tema': 'oscuro' })
  })

  /**
   * La rama que el plan tenía mal.
   *
   * Sin atributo, `:root:not([data-tema])` matchea y la media query
   * `prefers-color-scheme: dark` se aplica: alguien que eligió claro con el
   * sistema en oscuro vería la app oscura. Su elección explícita perdería
   * contra el sistema.
   */
  it('claro TAMBIÉN escribe atributo: es lo que le gana a la preferencia del sistema', () => {
    expect(atributoDeTema('claro')).toEqual({ 'data-tema': 'claro' })
  })

  it('sistema no escribe nada: deja decidir a prefers-color-scheme', () => {
    expect(atributoDeTema('sistema')).toEqual({})
    expect('data-tema' in atributoDeTema('sistema')).toBe(false)
  })

  it('los tres valores producen resultados distintos entre sí', () => {
    const resultados = TEMAS.map((t) => JSON.stringify(atributoDeTema(t)))

    expect(new Set(resultados).size).toBe(3)
  })
})
