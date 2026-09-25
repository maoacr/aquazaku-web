import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El modal no hereda la tipografía de donde se declaró.
 *
 * ── El bug que esto evita ───────────────────────────────────────────────────
 *
 * Un `<dialog>` se DIBUJA en la top layer pero sigue siendo hijo de donde vive
 * en el DOM, así que hereda de su padre todo lo heredable.
 *
 * Seguimientos montó uno dentro de la celda del lápiz, que lleva
 * `whitespace-nowrap` y `text-right` para que esa columna no estire la tabla.
 * Medido en el navegador: `white-space: nowrap` en TODO el formulario y
 * **1007 px** de desborde. Ningún texto podía envolver.
 *
 * ── Por qué se arregla en el modal y no en la celda ─────────────────────────
 *
 * Quitarle `whitespace-nowrap` a esa celda arreglaba ESTA pantalla y dejaba la
 * trampa armada: el próximo modal que alguien monte dentro de una tabla se
 * rompe igual, y el síntoma —«el formulario se desborda»— no señala en ningún
 * momento a una clase de una celda tres niveles más arriba.
 *
 * ── Por qué es un test de texto y no de layout ──────────────────────────────
 *
 * `jsdom` no hace layout: no calcula anchos, así que no puede ver un desborde.
 * Lo que sí puede es comprobar que la regla siga escrita. Es poco, y es más que
 * nada — sin esto, alguien limpia dos líneas que «no hacen nada» y devuelve
 * 1007 px de desborde sin que ningún test se entere.
 */
describe('.aq-modal', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
  const regla = css.slice(css.indexOf('.aq-modal {'), css.indexOf('.aq-modal::backdrop'))

  it('neutraliza el `white-space` que pueda heredar', () => {
    expect(regla).toMatch(/white-space:\s*normal/)
  })

  it('neutraliza el `text-align` que pueda heredar', () => {
    expect(regla).toMatch(/text-align:\s*start/)
  })
})
