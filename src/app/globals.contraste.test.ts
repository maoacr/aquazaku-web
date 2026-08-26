import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contraste WCAG de los pares fondo/texto declarados por el sistema de diseño.
 *
 * ── Por qué sobre los tokens y no sobre el DOM ──────────────────────────────
 *
 * `axe` corriendo en jsdom **no puede medir contraste**: necesita un motor de
 * render real que resuelva colores computados. Un test que dijera "el contraste
 * está bien" desde jsdom estaría mintiendo.
 *
 * Sobre los tokens sí se puede, y da un resultado exacto: los hex están en los
 * archivos, y la fórmula de WCAG es aritmética. Lo que este test NO cubre es
 * que alguien use el par equivocado en una pantalla —eso lo agarra el ojo, y la
 * revisión visual en claro y oscuro sigue siendo obligatoria—. Lo que sí
 * garantiza es que **ningún par declarado del sistema sea ilegible**, en
 * ninguno de los dos modos.
 */

const CARPETA = join(import.meta.dirname, '.')

/** Mínimo de WCAG 2.1 AA para texto normal. */
const MINIMO_AA = 4.5

/**
 * Los cinco pares de D2. El fondo y el texto de cada fila se usan JUNTOS: son
 * indivisibles, y ese es exactamente el punto que este test protege.
 */
const PARES_DECLARADOS = [
  { nombre: 'bg-accion + text-invertido', fondo: '--aq-accion-primaria', texto: '--aq-texto-invertido' },
  { nombre: 'bg-destructiva + text-invertido', fondo: '--aq-accion-destructiva', texto: '--aq-texto-invertido' },
  { nombre: 'bg-exito-fondo + text-exito-texto', fondo: '--aq-estado-exito-fondo', texto: '--aq-estado-exito-texto' },
  { nombre: 'bg-alerta-fondo + text-alerta-texto', fondo: '--aq-estado-alerta-fondo', texto: '--aq-estado-alerta-texto' },
  { nombre: 'bg-error-fondo + text-error-texto', fondo: '--aq-estado-error-fondo', texto: '--aq-estado-error-texto' },
] as const

/**
 * Las nueve combinaciones donde se lee todo lo demás: los tres niveles de texto
 * sobre las tres superficies. No están en la tabla de D2 porque no son "pares de
 * acción", pero si una falla no se puede leer la app.
 *
 * Las nueve, y no solo las que hoy se usan: `tenue` sobre `tarjeta` daba 4,04:1
 * y no lo vio nadie, porque en la pantalla donde se miró ese texto caía sobre el
 * fondo y no sobre una tarjeta. El ojo revisa lo que está a la vista; la tabla
 * revisa lo que el sistema permite.
 */
const SUPERFICIES_DE_LECTURA = ['fondo', 'tarjeta', 'elevada'].flatMap((superficie) =>
  ['principal', 'secundario', 'tenue'].map((nivel) => ({
    nombre: `${superficie} + ${nivel}`,
    fondo: `--aq-superficie-${superficie}`,
    texto: `--aq-texto-${nivel}`,
  })),
)

/**
 * El enlace suave es texto y le aplica el mismo 4,5:1 que a cualquier otro.
 *
 * Está separado de la lista de arriba porque no es un nivel de la jerarquía de
 * lectura: es un color de acción, y se eligió por el tono de la marca. Sin esta
 * fila, el celeste `#8CF0FA` que se ve bien en oscuro podía cruzar a modo claro
 * —donde da 1,2:1— y nadie se enteraba hasta abrirlo de día.
 */
const ENLACE_SUAVE = ['fondo', 'tarjeta', 'elevada'].map((superficie) => ({
  nombre: `${superficie} + accion-suave`,
  fondo: `--aq-superficie-${superficie}`,
  texto: '--aq-accion-suave',
}))

/**
 * El AGUA, que es la superficie donde realmente cae el texto suelto.
 *
 * `--aq-superficie-fondo` es un token opaco que casi no se ve: el fondo real de
 * la app es `--aq-agua`, un gradiente fijo que cubre el viewport. El rótulo de
 * una sección, la bajada de un título y los avisos caen sobre ESO, no sobre el
 * token.
 *
 * Sin esta fila, hundir el agua en claro dejó `tenue` en 4,10:1 y la suite
 * siguió en verde, porque estaba mirando la superficie equivocada. Es la misma
 * lección que ya costó cuatro botones invisibles: medir lo que se ve.
 *
 * Se toman las tres paradas del gradiente, no solo la del medio: el texto puede
 * caer sobre cualquiera.
 */
const PARADAS_DEL_AGUA = ['principal', 'secundario', 'tenue'].flatMap((nivel) =>
  [0, 1, 2].map((parada) => ({
    nombre: `agua[${parada}] + ${nivel}`,
    fondo: `--aq-agua#${parada}`,
    texto: `--aq-texto-${nivel}`,
  })),
)

describe('contraste de los pares fondo/texto', () => {
  const claro = leerTokens('claro')
  const oscuro = leerTokens('oscuro')

  for (const modo of [
    { etiqueta: 'claro', tokens: claro },
    { etiqueta: 'oscuro', tokens: oscuro },
  ]) {
    describe(`en modo ${modo.etiqueta}`, () => {
      for (const par of [
        ...PARES_DECLARADOS,
        ...SUPERFICIES_DE_LECTURA,
        ...ENLACE_SUAVE,
        ...PARADAS_DEL_AGUA,
      ]) {
        it(`${par.nombre} llega a ${MINIMO_AA}:1`, () => {
          const fondo = resolver(par.fondo, modo.tokens)
          const texto = resolver(par.texto, modo.tokens)
          const razon = contraste(fondo, texto)

          // El mensaje lleva los hex resueltos: si falla, no hay que ir a
          // buscar a mano qué color terminó siendo cada variable.
          expect(
            razon,
            `${par.nombre} en ${modo.etiqueta}: ${fondo} sobre ${texto} da ${razon.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MINIMO_AA)
        })
      }
    })
  }

  /**
   * El icono decorativo tiene otro mínimo, y por eso va aparte.
   *
   * No es texto: es el glifo en la esquina de una tarjeta, y lo que dice está
   * escrito al lado. WCAG pide 3:1 para un elemento gráfico, no 4,5:1.
   *
   * Existe como token para que los iconos dejen de robarse `secundario` — el
   * mismo valor que la prosa— y compitan con el texto que acompañan. El test
   * está para que ese tono no se siga bajando «porque es decorativo» hasta
   * desaparecer.
   */
  const MINIMO_GRAFICO = 3
  for (const modo of [
    { etiqueta: 'claro', tokens: claro },
    { etiqueta: 'oscuro', tokens: oscuro },
  ]) {
    for (const superficie of ['fondo', 'tarjeta', 'elevada']) {
      it(`el icono decorativo sobre ${superficie} en ${modo.etiqueta} llega a ${MINIMO_GRAFICO}:1`, () => {
        const fondo = resolver(`--aq-superficie-${superficie}`, modo.tokens)
        const icono = resolver('--aq-icono-decorativo', modo.tokens)
        const razon = contraste(fondo, icono)

        expect(
          razon,
          `icono sobre ${superficie} en ${modo.etiqueta}: ${fondo} / ${icono} da ${razon.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MINIMO_GRAFICO)
      })
    }
  }

  /**
   * Un icono decorativo que iguala a `tenue` no es una capa: es más texto.
   *
   * Es el defecto que este token vino a arreglar, así que se verifica que la
   * separación exista de verdad y no solo en la intención.
   */
  it('el icono decorativo se distingue de `tenue`', () => {
    for (const [etiqueta, tokens] of [
      ['claro', claro],
      ['oscuro', oscuro],
    ] as const) {
      const icono = resolver('--aq-icono-decorativo', tokens)
      const tenue = resolver('--aq-texto-tenue', tokens)

      expect(icono, `en ${etiqueta} el icono y \`tenue\` son el mismo hex`).not.toBe(tenue)
      expect(
        contraste(icono, tenue),
        `en ${etiqueta} el icono y \`tenue\` casi no se separan`,
      ).toBeGreaterThan(1.2)
    }
  })

  /**
   * El test se cuida a sí mismo. Sin esto, un error en el parser o en la
   * fórmula haría pasar todo en verde y el test dejaría de significar algo.
   */
  it('reprueba un par ilegible', () => {
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2)
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
    expect(contraste('#FFFFFF', '#CCCCCC')).toBeLessThan(MINIMO_AA)
  })

  it('resuelve cadenas de var() hasta el hex', () => {
    // `--aq-texto-principal` es `var(--aq-neutro-900)` en claro: si el resolver
    // devolviera el `var(...)` sin seguirlo, esto no sería un hex.
    expect(resolver('--aq-texto-principal', claro)).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(resolver('--aq-texto-principal', oscuro)).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('el modo oscuro cambia de verdad los tokens de estado', () => {
    // Si el bloque oscuro dejara de aplicarse, los tests de arriba pasarían
    // midiendo dos veces el modo claro y no lo notaríamos.
    expect(resolver('--aq-estado-exito-fondo', oscuro)).not.toBe(
      resolver('--aq-estado-exito-fondo', claro),
    )
  })
})

/**
 * Junta las declaraciones de `tokens.css` y `globals.css` para un modo.
 *
 * `tokens.css` es la copia del sistema de diseño y `globals.css` ajusta encima
 * los tokens de estado, así que el orden importa: lo segundo pisa a lo primero,
 * igual que en la cascada real.
 */
function leerTokens(modo: 'claro' | 'oscuro'): Map<string, string> {
  const declaraciones = new Map<string, string>()

  for (const archivo of ['tokens.css', 'globals.css']) {
    const css = readFileSync(join(CARPETA, archivo), 'utf8')

    // El modo claro es la base; el oscuro es la base con el bloque de oscuro
    // aplicado encima. Así se comporta el CSS.
    for (const selector of modo === 'claro' ? [':root'] : [':root', '[data-tema=oscuro]']) {
      for (const [nombre, valor] of declaracionesDe(css, selector)) {
        declaraciones.set(nombre, valor)
      }
    }
  }

  return declaraciones
}

/**
 * Saca los `--nombre: valor;` de un bloque, buscándolo por selector.
 *
 * Los dos archivos escriben el atributo distinto —uno con comillas dobles y el
 * otro con simples—, así que la búsqueda normaliza antes de comparar.
 */
function declaracionesDe(css: string, selector: string): Array<[string, string]> {
  const normalizado = css.replaceAll(/["']/g, '')
  const salida: Array<[string, string]> = []

  let desde = 0
  for (;;) {
    const inicio = normalizado.indexOf(`${selector} {`, desde)
    if (inicio === -1) break

    const abre = normalizado.indexOf('{', inicio)
    const cierra = normalizado.indexOf('}', abre)
    const cuerpo = normalizado.slice(abre + 1, cierra)

    for (const linea of cuerpo.split('\n')) {
      const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(linea)
      if (m) salida.push([m[1]!, m[2]!.trim()])
    }

    desde = cierra + 1
  }

  return salida
}

/** Sigue la cadena de `var(--x)` hasta llegar a un color literal. */
function resolver(nombre: string, tokens: Map<string, string>, saltos = 0): string {
  if (saltos > 10) throw new Error(`cadena de var() circular en ${nombre}`)

  // `--aq-agua#1` = la segunda parada del gradiente. El agua no es un color
  // sino un `linear-gradient`, y el texto puede caer sobre cualquiera de sus
  // paradas — así que cada una se mide por separado.
  const gradiente = /^(--[\w-]+)#(\d+)$/.exec(nombre)
  if (gradiente) {
    const declarado = tokens.get(gradiente[1]!)
    if (declarado === undefined) throw new Error(`el token ${gradiente[1]} no está declarado`)

    const paradas = declarado.match(/#[0-9A-Fa-f]{6}\b/g) ?? []
    const parada = paradas[Number(gradiente[2])]

    if (parada === undefined) {
      throw new Error(`${gradiente[1]} no tiene la parada ${gradiente[2]}: ${declarado}`)
    }
    return parada
  }

  const valor = tokens.get(nombre)
  if (valor === undefined) throw new Error(`el token ${nombre} no está declarado`)

  const m = /^var\((--[\w-]+)\)$/.exec(valor)
  return m ? resolver(m[1]!, tokens, saltos + 1) : valor
}

/** Relación de contraste de WCAG 2.1: `(L1 + 0.05) / (L2 + 0.05)`. */
function contraste(unColor: string, otroColor: string): number {
  const a = luminancia(unColor)
  const b = luminancia(otroColor)
  const [claro, oscuro] = a > b ? [a, b] : [b, a]

  return (claro! + 0.05) / (oscuro! + 0.05)
}

/** Luminancia relativa de WCAG, con la corrección de gamma que pide la norma. */
function luminancia(hex: string): number {
  const canales = aRgb(hex).map((canal) => {
    const c = canal / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * canales[0]! + 0.7152 * canales[1]! + 0.0722 * canales[2]!
}

function aRgb(hex: string): [number, number, number] {
  const limpio = hex.trim().replace('#', '')
  if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(limpio)) {
    throw new Error(`no es un hex: ${hex}`)
  }

  const seis =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio

  return [
    Number.parseInt(seis.slice(0, 2), 16),
    Number.parseInt(seis.slice(2, 4), 16),
    Number.parseInt(seis.slice(4, 6), 16),
  ]
}
