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

/**
 * Este defecto apareció TRES veces, así que deja de ser casualidad.
 *
 * Las clases del sistema van sin capa, así que le ganan a las utilidades de
 * Tailwind, que viven en `@layer utilities`. Eso es lo que se quiere para
 * colores y sombras. Para `position` y `display` es una trampa: el menú es
 * `fixed` en teléfono, y una clase que declare `position: relative` se lo saca.
 *
 * Cuando eso pasa, el cajón deja de flotar y se mete en el grid con un
 * `grid-area` que en móvil no existe: el armazón se llena de filas implícitas y
 * la pantalla se desarma. No falla ruidosamente — se ve raro y hay que ir a
 * buscarlo.
 */
describe('las clases del sistema no le sacan el posicionamiento a nadie', () => {
  it('`.aq-panel-marca` no declara `position`', () => {
    for (const bloque of bloquesDe(globales, '.aq-panel-marca')) {
      expect(bloque, `declara position: ${bloque}`).not.toMatch(/(^|[;{\s])position\s*:/)
    }
  })

  it('tampoco declara `display`, por la misma razón', () => {
    for (const bloque of bloquesDe(globales, '.aq-panel-marca')) {
      expect(bloque).not.toMatch(/(^|[;{\s])display\s*:/)
    }
  })

  /**
   * El menú tiene que seguir siendo `fixed` en el CSS del componente. Si alguien
   * se lo saca, los tests de arriba pasan y el cajón igual se rompe.
   */
  it('el menú sigue declarando su propio posicionamiento', () => {
    const cajon = readFileSync(join(process.cwd(), 'src/components/ui/cajon-navegacion.tsx'), 'utf8')

    expect(cajon).toMatch(/aq-panel-marca[^"`]*\bfixed\b/)
    expect(cajon).toMatch(/sm:relative/)
  })
})

/**
 * Los cuerpos de las reglas cuyo selector es EXACTAMENTE el que se pide.
 *
 * Un `matchAll` sobre el texto crudo no sirve: los comentarios que **mencionan**
 * la clase entran como si fueran reglas, y ahí el test empieza a reportar
 * defectos que no existen. Por eso primero se sacan los comentarios y después se
 * compara selector por selector — `.aq-panel-marca a` y `.aq-panel-marca::after`
 * son otras reglas, y pueden declarar lo que quieran.
 */
function bloquesDe(css: string, selector: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const cuerpos: string[] = []

  for (const regla of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectores = (regla[1] ?? '').split(',').map((s) => s.trim())

    if (selectores.includes(selector)) cuerpos.push(regla[2] ?? '')
  }

  return cuerpos
}

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

/**
 * ── Las primitivas de formulario existen para que nadie escriba la suya ──────
 *
 * Diez archivos repetían `rounded border border-fuerte bg-transparent px-2
 * py-1.5` copiado, y los botones salían en tres alturas distintas —`py-2`,
 * `h-14`, `min-h-11`—. Por eso los formularios de auditoría y de usuarios se
 * veían de otro sistema: no había con qué construirlos.
 *
 * Este test es lo que impide que vuelva a pasar. Es de texto y no de render a
 * propósito: el problema nunca fue cómo se ve UNA pantalla, fue que cada
 * pantalla decidiera por su cuenta.
 */
describe('los formularios se construyen con las primitivas del sistema', () => {
  const componentes = archivosTsx(join(process.cwd(), 'src'))

  it('ningún componente dibuja su propio campo', () => {
    const culpables = componentes.filter(({ contenido }) => contenido.includes('border-fuerte'))

    expect(
      culpables.map((c) => c.ruta),
      'usan `border-fuerte` a mano en vez de `.aq-campo` o `.aq-boton-secundario`',
    ).toEqual([])
  })

  it('ningún componente dibuja su propio botón primario', () => {
    // `bg-accion` seguido de padding es la firma de un botón hecho a mano. El
    // token en sí es legítimo —lo usa `.aq-boton-primario`— así que se busca la
    // combinación, no el token.
    const culpables = componentes.filter(({ contenido }) => /bg-accion\s+px-|h-14\s+rounded/.test(contenido))

    expect(
      culpables.map((c) => c.ruta),
      'arman un botón a mano en vez de usar `.aq-boton aq-boton-primario`',
    ).toEqual([])
  })

  it('ninguna pantalla elige el tamaño de su propio título', () => {
    // Había CUATRO tamaños para el mismo rol: 24 px, 28→32 y 32. Una escala que
    // cada pantalla reinterpreta no es una escala.
    const culpables = componentes.filter(({ contenido }) =>
      /<h1[^>]*className="[^"]*(text-\dxl|text-\[\d)/.test(contenido),
    )

    expect(
      culpables.map((c) => c.ruta),
      'fijan el tamaño del `<h1>` a mano en vez de usar `.aq-titulo-pantalla`',
    ).toEqual([])
  })

  it('ninguna casilla se dibuja cruda', () => {
    // La regla de los 44 px exime a `checkbox` y a `radio` porque agrandar la
    // caja los deforma. Esa exención dejó el control más chico de la app —16 px
    // nativos— en la pantalla donde se decide quién puede hacer qué.
    //
    // La salida es que el objetivo sea la FICHA entera, no la caja. Un checkbox
    // con clase de tamaño es alguien volviendo a estilar la caja.
    const culpables = componentes.filter(({ contenido }) =>
      /type="checkbox"[\s\S]{0,200}?className="[^"]*\bsize-/.test(contenido),
    )

    expect(
      culpables.map((c) => c.ruta),
      'estilan la casilla en vez de usar `.aq-ficha`, que se toca entera',
    ).toEqual([])
  })

  it('la ficha se toca entera y llega al mínimo táctil', () => {
    const ficha = bloque(globales, '.aq-ficha')

    expect(ficha).toMatch(/min-height:\s*44px/)
    // Sin `cursor: pointer` una superficie de 44 px no se anuncia como tocable.
    expect(ficha).toMatch(/cursor:\s*pointer/)
  })

  it('el foco salta del input a la ficha', () => {
    // El input es `sr-only`: mide 1 px, y ahí el anillo global se dibuja donde
    // no lo ve nadie. Se resuelve moviéndolo, NUNCA apagando la regla global.
    expect(globales).toMatch(/\.aq-ficha:has\(input:focus-visible\)\s*\{[^}]*outline:/)
  })

  it('el campo se ve HUNDIDO, que es lo que lo distingue de una tarjeta', () => {
    const campo = bloque(globales, '.aq-campo')

    // Sin fondo propio, sobre el agua un campo se lee como un borde dibujado
    // encima del gradiente. Era el defecto que más se notaba.
    expect(campo).toMatch(/background:\s*var\(--aq-campo-fondo\)/)
    expect(campo, 'la sombra tiene que ser interna: hacia afuera lo haría flotar').toMatch(
      /box-shadow:\s*inset/,
    )
  })

  it('el campo no se pelea con el anillo de foco', () => {
    // Es el error que ya dejó el foco invisible una vez: una sombra propia en
    // `:focus` compite con el `outline` global.
    expect(bloque(globales, '.aq-campo')).not.toMatch(/:focus/)
  })

  it('el botón compacto solo se angosta, nunca se achica', () => {
    const compacto = bloque(globales, '.aq-boton-compacto')

    expect(compacto, 'toca padding vertical: el dedo no se achica en una tabla').not.toMatch(
      /padding:[^;]*\d+(px|rem)\s+[\d.]+(px|rem)\s+/,
    )
    expect(compacto).not.toMatch(/min-height/)
  })
})

/**
 * La cabecera se monta sobre el contenido, y eso vive en CSS.
 *
 * Estaba como `style={{ gridArea: 'cabecera' }}` inline, y un `style` le gana a
 * cualquier clase: la regla de escritorio no podía moverla por más que lo
 * dijera la hoja de estilos. Es la tercera vez que un valor puesto en el lugar
 * equivocado de la cascada rompe el armazón.
 */
describe('el armazón deja que la cabecera flote', () => {
  const armazon = readFileSync(
    join(process.cwd(), 'src/components/ui/cajon-navegacion.tsx'),
    'utf8',
  )

  it('la cabecera no fija su área con un style inline', () => {
    expect(armazon, 'un `style` inline le gana a la media query de escritorio').not.toMatch(
      /gridArea:\s*'cabecera'/,
    )
  })

  it('la cabecera lleva la clase que el CSS posiciona', () => {
    expect(armazon).toMatch(/className="aq-cabecera/)
  })

  it('en escritorio ocupa el área del contenido, encima', () => {
    const regla = bloque(globales, '.aq-cabecera', { ultimo: true })

    expect(regla).toMatch(/grid-area:\s*contenido/)
    expect(regla).toMatch(/z-index:\s*1/)
    // Sin esto la cabecera es una banda invisible de lado a lado que se come
    // los clics de la primera línea del contenido.
    expect(regla).toMatch(/pointer-events:\s*none/)
  })

  it('los controles de la cabecera sí reciben clics', () => {
    expect(bloque(globales, '.aq-cabecera > *')).toMatch(/pointer-events:\s*auto/)
  })
})

/** Los `.tsx` de `src/`, con su ruta relativa para que el error sea accionable. */
function archivosTsx(desde: string): Array<{ ruta: string; contenido: string }> {
  const salida: Array<{ ruta: string; contenido: string }> = []

  for (const entrada of readdirSync(desde, { withFileTypes: true })) {
    const completa = join(desde, entrada.name)

    if (entrada.isDirectory()) {
      if (entrada.name === '__tests__' || entrada.name === 'node_modules') continue
      salida.push(...archivosTsx(completa))
    } else if (entrada.name.endsWith('.tsx')) {
      salida.push({
        ruta: completa.slice(process.cwd().length + 1),
        contenido: readFileSync(completa, 'utf8'),
      })
    }
  }

  return salida
}

/** El cuerpo de una regla CSS por selector exacto. `ultimo` toma la de la media query. */
function bloque(css: string, selector: string, { ultimo = false } = {}): string {
  const escapado = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const encontrados = [...css.matchAll(new RegExp(`(?:^|[},])\\s*${escapado}\\s*\\{([^}]*)\\}`, 'gm'))]

  if (encontrados.length === 0) throw new Error(`no existe la regla \`${selector}\``)

  const elegido = ultimo ? encontrados.at(-1) : encontrados[0]
  return elegido?.[1] ?? ''
}
