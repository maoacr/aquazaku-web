import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La interfaz habla de usted.
 *
 * El sistema de diseño lo dice sin margen: **«Español de Colombia, trato de
 * "usted". No voseo, no "tú"»**. No es una preferencia de estilo — es cómo se
 * habla en Campo de la Cruz, y una app que tutea a alguien de sesenta años que
 * lleva veinte en la planta suena a extranjero.
 *
 * ── Por qué un test y no una revisión ───────────────────────────────────────
 *
 * Una voz se pierde de a una frase. Nadie decide cambiarla: alguien escribe
 * «Probá de nuevo» un martes porque le salió así, y a los seis meses la mitad
 * del producto vosea. Revisarlo a ojo funciona el día que se revisa.
 *
 * Este test corre siempre y falla en la línea exacta.
 */
const RAIZ = join(process.cwd(), 'src')

/**
 * ── Ojo con `\b` y las tildes ───────────────────────────────────────────────
 *
 * En JavaScript, `\b` se define contra `\w`, que es `[A-Za-z0-9_]`. Una `á`
 * **no** es un carácter de palabra, así que entre `á` y un espacio no hay
 * frontera: `/\bprobá\b/` no coincide nunca con «probá de nuevo».
 *
 * Es una trampa silenciosa —el mismo patrón en Python SÍ funciona, porque ahí
 * `á` cuenta como letra— y el precio es un guardián que pasa en verde mientras
 * la app entera vosea. Por eso el cierre es `(?![…])`: «que no siga una letra».
 */
const FIN_DE_PALABRA = '(?![a-záéíóúüñ])'

/**
 * Imperativos voseantes: el verbo con tilde en la última sílaba.
 *
 * `probá`, `elegí`, `poné`, `revisá`. La lista es de raíces y no de un patrón
 * genérico `\w+á` porque en español hay muchísimas palabras que terminan así y
 * no son imperativos —«está», «acá», «allá», «quizá»—.
 */
const IMPERATIVO_VOSEANTE = new RegExp(
  `\\b(?:revis|eleg|ingres|prob|volv|esper|pon|and|mir|ped|avis|recarg|carg|dej|ten|fij|segu|escrib|complet|confirm|guard|anul|busc|cambi|actualiz|registr|us|abr|cerr|toc|hac|sac|sum|rest|agreg|quit|habl|copi|mand|llam|firm|acept|rechaz|descart|ajust)(?:á|é|í)${FIN_DE_PALABRA}`,
  'i',
)

/** Formas verbales de vos: `podés`, `tenés`, `sabés`. */
const VERBO_VOSEANTE = new RegExp(
  `\\b(?:podés|tenés|sabés|querés|creés|hacés|debés|vas a|estás|sos|estabas|tenías|podías)${FIN_DE_PALABRA}`,
  'i',
)

/** Tuteo: `tú`, `puedes`, `olvidaste`. */
const TUTEO = new RegExp(
  `\\b(?:tú|tienes|puedes|debes|quieres|olvidaste|sabes|vienes)${FIN_DE_PALABRA}`,
  'i',
)

/** Pronombres y posesivos de tú/vos: `tu`, `tus`, `vos`, `tuyo`. */
const POSESIVO = /\b(?:tu|tus|vos|ti|tuyo|tuya|tuyos|tuyas|contigo)\b/i

const REGLAS: Array<[string, RegExp]> = [
  ['imperativo voseante', IMPERATIVO_VOSEANTE],
  ['verbo voseante', VERBO_VOSEANTE],
  ['tuteo', TUTEO],
  ['posesivo de tú/vos', POSESIVO],
]

/**
 * ── La excepción, y por qué existe ──────────────────────────────────────────
 *
 * Estos mensajes NO los lee un usuario de Aquazaku: los lee quien levanta el
 * servidor y le falta una variable de entorno. Son la misma audiencia que
 * `/docs`, que también sigue en voseo a propósito — dos voces distintas para
 * dos lectores distintos.
 *
 * Va como lista de frases exactas y no como lista de archivos. Un archivo
 * excluido deja de mirarse entero, y el día que alguien le agregue un texto de
 * interfaz nadie se entera. Así, agregar un mensaje de arranque obliga a
 * anotarlo acá — o sea, a decidirlo a propósito.
 */
const VOZ_DE_DESARROLLADOR = ['Copiá .env.example a .env.local y completala.']

describe('la interfaz habla de usted', () => {
  const archivos = fuentesDeInterfaz()

  it('mira una cantidad de archivos que tiene sentido', () => {
    // Si el recorrido se rompe y devuelve cero, todo lo de abajo pasa en verde
    // sin haber mirado nada.
    expect(archivos.length).toBeGreaterThan(30)
  })

  it('no queda voseo ni tuteo en ningún texto de interfaz', () => {
    const hallazgos: string[] = []

    for (const archivo of archivos) {
      const lineas = sinComentarios(readFileSync(archivo, 'utf8')).split('\n')

      lineas.forEach((linea, i) => {
        if (VOZ_DE_DESARROLLADOR.some((frase) => linea.includes(frase))) return

        for (const [nombre, regla] of REGLAS) {
          const encontrado = regla.exec(linea)
          if (!encontrado) continue

          hallazgos.push(
            `${archivo.replace(process.cwd(), '')}:${i + 1} — ${nombre}: «${encontrado[0]}» en «${linea.trim().slice(0, 80)}»`,
          )
        }
      })
    }

    expect(hallazgos, `\n${hallazgos.join('\n')}\n`).toEqual([])
  })

  /**
   * El test se cuida a sí mismo: si las reglas dejaran de detectar, el de
   * arriba pasaría en verde con la app entera voseando.
   */
  it('las reglas detectan lo que dicen detectar', () => {
    // Este es el caso que atrapó el bug de `\b` con tildes.
    expect(IMPERATIVO_VOSEANTE.test('Probá de nuevo')).toBe(true)
    expect(IMPERATIVO_VOSEANTE.test('Elegí una presentación')).toBe(true)
    expect(IMPERATIVO_VOSEANTE.test('recargá para ver el último')).toBe(true)
    expect(VERBO_VOSEANTE.test('no tenés permiso')).toBe(true)
    expect(TUTEO.test('¿olvidaste tu contraseña?')).toBe(true)
    expect(POSESIVO.test('revise tus roles')).toBe(true)
  })

  /**
   * Y no detecta de más: un test que grite por «está» o «acá» se apaga solo
   * porque nadie tolera un guardián que miente.
   */
  it('no confunde palabras que legítimamente llevan tilde final', () => {
    for (const inocente of [
      'El lote está vencido',
      'Se registra acá',
      'Quizá no haya unidades',
      'El café de la planta',
      'Más allá del vencimiento',
    ]) {
      for (const [, regla] of REGLAS) {
        expect(regla.test(inocente), `«${inocente}» marcado por ${regla}`).toBe(false)
      }
    }
  })
})

/** Los `.ts` y `.tsx` de la app, sin los tests. */
function fuentesDeInterfaz(): string[] {
  return readdirSync(RAIZ, { recursive: true, encoding: 'utf8' })
    .filter((nombre) => /\.tsx?$/.test(nombre) && !nombre.includes('.test.'))
    .map((nombre) => join(RAIZ, nombre))
}

/**
 * Saca comentarios antes de mirar.
 *
 * Los comentarios de este proyecto están escritos para quien lee el código —la
 * misma voz que `/docs`— y llenarlos de «usted» sería raro. Lo que tiene que
 * hablar de usted es lo que ve una persona en la pantalla.
 */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
