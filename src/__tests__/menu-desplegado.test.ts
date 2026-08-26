import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El riel colapsado, cuando se despliega.
 *
 * Nada de esto se puede verificar renderizando: `:hover` y `@media` no existen
 * en jsdom. Se verifica leyendo el CSS, que es el mismo patrón que ya protege
 * los dos bloques de tema y la columna fija de las tablas.
 *
 * Vale la pena porque las tres reglas fallan **en silencio**: el menú sigue
 * funcionando, solo que desalineado o tapando la pantalla, y nadie lo relaciona
 * con la regla que se movió.
 */
const globales = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** El bloque de una regla, desde su selector hasta la llave que lo cierra. */
function bloque(selector: string): string {
  const i = globales.indexOf(selector)
  if (i === -1) throw new Error(`no existe la regla \`${selector}\``)

  return globales.slice(i, globales.indexOf('}', i))
}

describe('al desplegarse, el menú empuja en vez de taparse encima', () => {
  /**
   * ── Lo que Aquazaku pidió, y por qué es una sola apertura y no dos ────────
   *
   * Antes el hover superponía el panel y `main` no se enteraba: quedaba una capa
   * flotando sobre el contenido en vez de un menú abriéndose. Ahora la pista de
   * la grilla crece igual que con el toggle explícito.
   */
  it('la pista de la grilla crece con el hover, igual que con el toggle', () => {
    const regla = bloque('.aq-armazon:has(> .aq-menu-colapsado:hover)')

    expect(regla).toContain('--aq-menu-ancho: 16rem')
  })

  /** Con teclado no hay hover. Sin esto, tabular al menú no lo abriría. */
  it('el foco de teclado abre igual que el mouse', () => {
    expect(globales).toContain('.aq-armazon:has(> .aq-menu-colapsado:focus-within)')
  })

  /**
   * ── El isotipo se alinea con los ICONOS, no con el borde del panel ────────
   *
   * Los iconos de los links caen en nav(12) + contenedor(12) + link(12) = 36.
   * El encabezado tiene que sumar los mismos 12 + 12, o el logo queda corrido
   * respecto de la columna que tiene justo debajo — que es contra lo que el ojo
   * lo compara.
   *
   * Estuvo mal 20 px porque de las DOS reglas que anulan el padding en
   * colapsado, solo una estaba atada al estado colapsado.
   */
  it('el encabezado conserva su sangrado al desplegarse', () => {
    const anulado = '.aq-menu-colapsado:not(:hover):not(:focus-within) .aq-menu-encabezado'

    expect(globales).toContain(`${anulado} {`)
    expect(globales).toContain(`${anulado} a {`)
  })

  it('el ancla del logo toma el mismo sangrado que un link', () => {
    const regla = bloque('.aq-menu-colapsado:hover .aq-menu-encabezado a')

    expect(regla).toContain('padding-inline: 0.75rem')
  })

  /**
   * Con la pista creciendo, treparse por encima de `main` no ordena nada y
   * volvería a poner el panel sobre el contenido — el defecto que esto arregla.
   */
  it('el riel desplegado ya no se trepa por encima de main', () => {
    const regla = bloque('.aq-menu-colapsado:hover,')

    expect(regla).not.toContain('z-index')
  })
})
