import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los dos bloques oscuros tienen que declarar lo mismo.
 *
 * `[data-tema="oscuro"]` cubre la elección explícita, y el bloque bajo
 * `prefers-color-scheme: dark` cubre el modo `sistema`. CSS no tiene forma de
 * reusar un bloque bajo otro selector, así que están duplicados.
 *
 * Sin este test, agregar un token al bloque oscuro y olvidarse del otro deja el
 * modo sistema **a medio pintar**: la mitad de la pantalla oscura y la otra
 * mitad clara. Y no lo nota nadie hasta que alguien con el sistema en oscuro
 * abre la app — que es justamente el caso que no se prueba a mano.
 */
const raiz = join(process.cwd(), 'src/app')
const tokens = readFileSync(join(raiz, 'tokens.css'), 'utf8')
const globales = readFileSync(join(raiz, 'globals.css'), 'utf8')

/**
 * Devuelve las declaraciones de un bloque como pares nombre → valor.
 *
 * Compara VALORES y no solo nombres. Un bloque puede declarar los mismos
 * tokens que el otro y aun así pintar distinto: es lo que pasó cuando se
 * corrigió el contraste de `--aq-texto-tenue` en el bloque explícito y el
 * generado se quedó con el valor viejo. Los nombres coincidían; la pantalla no.
 */
function declaracionesDe(css: string, selector: string): Map<string, string> {
  const bloque = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(css)
  if (!bloque) throw new Error(`no se encontró el bloque ${selector}`)

  return new Map(
    [...bloque[1]!.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1]!, m[2]!.trim()]),
  )
}

describe('el modo sistema pinta lo mismo que el oscuro explícito', () => {
  /*
   * `tokens.css` es la copia del sistema de diseño y `globals.css` la corrige
   * encima, así que el segundo pisa al primero — igual que en la cascada. Un
   * token declarado en los dos no es un error: es una corrección nuestra.
   */
  const explicito = new Map([
    ...declaracionesDe(tokens, '\\[data-tema="oscuro"\\]'),
    ...declaracionesDe(globales, "\\[data-tema='oscuro'\\]"),
  ])

  const porSistema = declaracionesDe(globales, ':root:not\\(\\[data-tema\\]\\)')

  const ordenado = (m: Map<string, string>) =>
    [...m].sort(([a], [b]) => a.localeCompare(b))

  it('declaran los mismos tokens CON LOS MISMOS VALORES', () => {
    expect(ordenado(porSistema)).toEqual(ordenado(explicito))
  })

  it('no es una lista vacía que pase por casualidad', () => {
    expect(explicito.size).toBeGreaterThan(20)
  })

  it('incluye las superficies: son las que se ven primero si falta algo', () => {
    expect([...porSistema.keys()]).toContain('--aq-superficie-fondo')
    expect([...porSistema.keys()]).toContain('--aq-texto-principal')
  })
})

describe('el foco nunca se suprime', () => {
  /**
   * El punto de venta se opera con teclado. Un `outline: none` sin reemplazo
   * deja a quien tabula sin saber dónde está parado.
   */
  it('hay una regla de foco con el anillo de la marca', () => {
    expect(tokens).toContain('focus-visible')
    expect(tokens).toContain('--aq-anillo-foco')
  })
})
