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
 * ── Por qué NO es una lista de verbos ───────────────────────────────────────
 *
 * Era una lista de cuarenta y tres raíces —`prob`, `eleg`, `pon`…— y dejó pasar
 * **«Repetí la contraseña nueva»**, en la primera pantalla que ve todo el mundo
 * al entrar por primera vez. `repet` no estaba, y no había forma de saberlo:
 * la lista de verbos del español no se termina de escribir nunca.
 *
 * Así que la carga se invierte. Se sospecha de **toda** palabra que termine en
 * tilde, y se anotan las que legítimamente lo hacen. Esa lista sí es corta y sí
 * se cierra: en español no hay muchas.
 *
 * El costo de equivocarse cambió de lado, que es lo importante. Antes, olvidar
 * un verbo dejaba pasar voseo en silencio. Ahora, olvidar una excepción rompe
 * el test y alguien la agrega en treinta segundos.
 */
const NO_SON_VOSEO = new Set([
  // Interrogativos. `qué` es, de lejos, el más común en esta interfaz: casi
  // todas las etiquetas de motivo empiezan con «Qué pasó».
  'qué',
  'cuál',
  'quién',
  'cuándo',
  'cómo',
  'dónde',
  // Primera persona. «Olvidé mi contraseña» lo dice el usuario, no la app.
  'olvidé',
  // Verbos y adverbios de todos los días.
  'está',
  'acá',
  'allá',
  'aquí',
  'ahí',
  'así',
  'quizá',
  'ojalá',
  'además',
  'atrás',
  'detrás',
  'jamás',
  'sí',
  'mí',
  // Sustantivos.
  'café',
  'sofá',
  'menú',
  'papá',
  'mamá',
  // Nombres propios que aparecen en este producto.
  'bogotá',
  'panamá',
  'atlántico',
  /*
   * ── El futuro en usted también termina en tilde ──────────────────────────
   *
   * «tendrá que entrar de nuevo» es correcto y suena igual de acentuado que
   * «probá». No hay regla que los separe: se intentó pedir que sacarle la `á`
   * dejara un infinitivo —`quedará` → `quedar`— y choca con los imperativos
   * más comunes: `mirá` deja `mir`, que termina en «ir», y `esperá` deja
   * `esper`, que termina en «er».
   *
   * Así que van acá. La lista va a crecer cuando el producto escriba en
   * futuro, y va a crecer **rompiendo el test**, que es exactamente lo que se
   * busca: el defecto anterior era pasar en verde con voseo adentro.
   */
  'esté',
  'será',
  'habrá',
  'tendrá',
  'podrá',
  'deberá',
  'hará',
  'dirá',
  'vendrá',
  'saldrá',
  'pondrá',
  'sabrá',
  'querrá',
])

/** Palabras que terminan en tilde: el universo de sospechosos. */
const TERMINA_EN_TILDE = /\b([a-záéíóúüñ]{2,}[áéí])(?![a-záéíóúüñ])/gi

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
function imperativoVoseante(linea: string): string | null {
  for (const [, palabra] of linea.matchAll(TERMINA_EN_TILDE)) {
    if (!NO_SON_VOSEO.has(palabra!.toLowerCase())) return palabra!
  }

  return null
}

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

const buscarCon = (regla: RegExp) => (linea: string) => regla.exec(linea)?.[0] ?? null

/**
 * Una regla es una función y no una expresión regular porque la del imperativo
 * ya no puede serlo: necesita descartar excepciones palabra por palabra.
 */
const REGLAS: Array<[string, (linea: string) => string | null]> = [
  ['imperativo voseante', imperativoVoseante],
  ['verbo voseante', buscarCon(VERBO_VOSEANTE)],
  ['tuteo', buscarCon(TUTEO)],
  ['posesivo de tú/vos', buscarCon(POSESIVO)],
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

        for (const [nombre, buscar] of REGLAS) {
          const encontrado = buscar(linea)
          if (encontrado === null) continue

          hallazgos.push(
            `${archivo.replace(process.cwd(), '')}:${i + 1} — ${nombre}: «${encontrado}» en «${linea.trim().slice(0, 80)}»`,
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
    expect(imperativoVoseante('Probá de nuevo')).toBe('Probá')
    expect(imperativoVoseante('Elegí una presentación')).toBe('Elegí')
    expect(imperativoVoseante('recargá para ver el último')).toBe('recargá')
    // El que se escapó de la lista de verbos y llegó a producción.
    expect(imperativoVoseante('Repetí la contraseña nueva')).toBe('Repetí')
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
      for (const [nombre, buscar] of REGLAS) {
        expect(buscar(inocente), `«${inocente}» marcado por ${nombre}`).toBeNull()
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
