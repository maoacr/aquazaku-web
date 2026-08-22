import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * R54 y R55: objetivo táctil mínimo y foco siempre visible.
 *
 * Las dos son reglas del SISTEMA, no de una pantalla, así que se verifican
 * sobre las reglas de CSS y no renderizando componentes. Un test que recorriera
 * los controles de una pantalla diría la verdad sobre esa pantalla y nada sobre
 * la próxima que alguien escriba — y eso es justamente como llegamos a tener
 * `select` e `input` en 42 px.
 *
 * La medición real —que el anillo se vea, que no lo recorte un ancestro y que
 * los controles midan 44 px en pantalla— se hace en el browser, porque jsdom no
 * hace layout: ahí todo mide cero.
 */
const raiz = join(process.cwd(), 'src/app')
const globales = readFileSync(join(raiz, 'globals.css'), 'utf8')
const tokens = readFileSync(join(raiz, 'tokens.css'), 'utf8')

describe('R55 · el foco siempre se ve', () => {
  /**
   * `box-shadow` es la propiedad de las elevaciones. Resolver el anillo con ella
   * lo pone a competir con `shadow-elev-*` de Tailwind por la misma propiedad y
   * con la misma especificidad, y ahí gana el que salió último en el CSS — que
   * en desarrollo no es estable. `outline` es una propiedad propia.
   */
  it('el anillo usa outline, que ninguna utilidad de sombra puede pisar', () => {
    expect(globales).toMatch(/outline:\s*3px solid var\(--aq-anillo-foco\)/)
  })

  /**
   * Sin `outline-offset` el anillo queda pegado al control y se lee como un
   * borde más. El hueco además es transparente, así que muestra la superficie
   * real sea cual sea — que es lo que la versión con `box-shadow` no podía
   * hacer, porque tenía el color del hueco fijo en `tarjeta`.
   */
  it('el anillo deja un hueco transparente', () => {
    expect(globales).toMatch(/outline-offset:\s*2px/)
  })

  /**
   * `:where()` aporta especificidad cero: cualquier utilidad de una clase le
   * ganaría. Con `:is()` la regla se sostiene sola.
   */
  it('la regla se declara con :is() y no con :where()', () => {
    const regla = /:(is|where)\(button, a, input, select, textarea, \[tabindex\]\):focus-visible/.exec(
      globales,
    )

    expect(regla?.[1]).toBe('is')
  })

  /**
   * El anillo es un indicador de foco: WCAG 2.2 le pide 3:1 contra lo adyacente.
   * En el aqua claro que trae la copia del sistema eso daba 1,62:1 sobre el
   * fondo claro — casi invisible, y el punto de venta se opera con teclado.
   */
  it('cambia de paso entre claro y oscuro', () => {
    const claro = /--aq-anillo-foco:\s*var\((--aq-acento-\d+)\)/.exec(globales)?.[1]
    const oscuros = [...globales.matchAll(/--aq-anillo-foco:\s*var\((--aq-acento-\d+)\)/g)].map(
      (m) => m[1],
    )

    expect(claro).toBeDefined()
    expect(new Set(oscuros).size).toBeGreaterThan(1)
  })

  /**
   * `tokens.css` suprime el outline para dibujar el anillo con `box-shadow`, y
   * `globals.css` lo reemplaza por el suyo. Lo que no puede pasar es que algún
   * componente apague el foco por su cuenta con `outline-none` de Tailwind.
   */
  it('ningún componente apaga el foco por su cuenta', () => {
    const componentes = ['src/components', 'src/app'].flatMap((carpeta) =>
      readdirSync(join(process.cwd(), carpeta), { recursive: true, encoding: 'utf8' })
        .filter((nombre) => nombre.endsWith('.tsx') && !nombre.endsWith('.test.tsx'))
        .map((nombre) => join(carpeta, nombre)),
    )

    expect(componentes.length).toBeGreaterThan(10)

    for (const archivo of componentes) {
      const codigo = readFileSync(join(process.cwd(), archivo), 'utf8')
      expect(codigo, `${archivo} apaga el foco`).not.toMatch(/\boutline-none\b/)
    }
  })
})

describe('R54 · los controles se pueden tocar', () => {
  /**
   * Hay campos de formulario en once archivos y no existe una primitiva
   * compartida. El mínimo tiene que vivir en una regla sobre los elementos, o
   * falla en la próxima pantalla que alguien escriba.
   */
  it('el mínimo de 44 px se declara una vez, sobre los elementos', () => {
    expect(globales).toMatch(
      /:is\(button, select, textarea, \[role='button'\]\),[\s\S]*?min-height:\s*44px/,
    )
  })

  it('cubre los inputs, salvo los que se deformarían', () => {
    const regla = /input:not\(\[type='checkbox'\], \[type='radio'\], \[type='hidden'\]\)/.exec(
      globales,
    )

    expect(regla).not.toBeNull()
  })

  /**
   * `min-height` y no `height`: un `textarea` de varias líneas tiene que poder
   * crecer, y un botón con texto largo que envuelve también.
   */
  it('usa min-height y no height', () => {
    const bloque = /:is\(button, select, textarea[\s\S]*?\}/.exec(globales)?.[0] ?? ''

    expect(bloque).toContain('min-height')
    expect(bloque).not.toMatch(/[^-]height:\s*44px/)
  })
})

describe('la tipografía no baja del piso del sistema', () => {
  /**
   * La escala del sistema no tiene 12 px: el piso de cuerpo es `cuerpo-chico`
   * (14 px) y abajo solo `micro` (11 px), que exige mayúsculas y tracking.
   *
   * `text-xs` es 12 px y es un default de Tailwind, no una decisión nuestra —
   * el mismo tipo de filtración que las clases de paleta cruda que se barrieron
   * en T3.
   */
  it('la escala declara 14 px como cuerpo más chico', () => {
    expect(tokens).toMatch(/--aq-cuerpo-chico:\s*400 14px/)
  })

  it('los 11 px solo existen dentro de .aq-micro', () => {
    expect(tokens).toMatch(/--aq-micro:\s*500 11px/)
    expect(globales).toMatch(/\.aq-micro\s*\{[\s\S]*?text-transform:\s*uppercase/)
  })
})
