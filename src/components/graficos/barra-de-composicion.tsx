/**
 * Las partes de un entero, en una barra.
 *
 * ── Por qué no es `BarrasHorizontales` ──────────────────────────────────────
 *
 * Contestan preguntas distintas. Allá se comparan filas entre sí —«¿quién debe
 * más?»— y la referencia es el MÁXIMO, para que la primera llegue al borde.
 * Aquí las partes suman un todo —«¿cómo se reparte la cartera?»— y la referencia
 * es la SUMA, porque la barra tiene que llenarse. Usar el máximo dejaría la
 * caja a medio llenar y eso se lee como si faltara un pedazo del dato.
 *
 * ── La rampa ordena, el texto identifica ────────────────────────────────────
 *
 * Los pasos salen de `--color-escala-1..4`: un solo tono, cuatro luminosidades,
 * donde el paso 4 es el prominente en los DOS temas (en claro es el más oscuro,
 * en oscuro el más claro — ver el comentario de la rampa en `globals.css`).
 *
 * Eso sirve para decir «más viejo» o «más lejos», que es un orden. NO sirve
 * para identificar: entre dos pasos vecinos hay una diferencia de luminosidad y
 * nada más, y a contraluz en la planta se pierde. Por eso la leyenda escribe
 * cada parte con su etiqueta y su valor, y la barra se marca decorativa.
 *
 * Es un Server Component: sin estado, sin efectos, cero JavaScript al browser.
 */

export interface ParteDeComposicion {
  etiqueta: string
  valor: number
  /** Ya formateado por quien tiene el dato. */
  texto: string
}

/**
 * ── Dos escalas, porque son dos preguntas ──────────────────────────────────
 *
 * `magnitud` es la rampa de un tono: sirve cuando las partes están ORDENADAS
 * —la cartera por edad, donde 0–30 va antes que 90+— y el paso más marcado es
 * el más grave.
 *
 * `categoria` son los dos tonos validados de la marca. Sirve cuando las partes
 * NO tienen orden: «en bodega» y «en poder de clientes» son dos lugares, no dos
 * grados. Pintarlos con la rampa inventaría una jerarquía que no existe.
 *
 * Son DOS cupos y no más. Medido con el validador: azul y verde están a ΔE 19,6
 * en visión plena y 18,5 en deuteranopía, pero sumar el acento como tercero lo
 * deja a ΔE 7,8 del verde — indistinguible a ojo pelado. Una composición
 * categórica de tres partes necesita otra forma, no un color más.
 */
const ESCALA = {
  magnitud: ['bg-escala-1', 'bg-escala-2', 'bg-escala-3', 'bg-escala-4'],
  categoria: ['bg-accion', 'bg-exito'],
} as const

export function BarraDeComposicion({
  partes,
  total,
  escala = 'magnitud',
}: {
  partes: ParteDeComposicion[]
  /**
   * `magnitud` cuando las partes están ordenadas (la cartera por edad);
   * `categoria` cuando no lo están (dónde está el parque). Ver `ESCALA`.
   */
  escala?: keyof typeof ESCALA
  /**
   * Ya formateado. Opcional, y NO se calcula sumando: un total que el
   * componente arma por su cuenta puede no coincidir con el que muestra el
   * resto de la pantalla —redondeos, partidas que no entran en ninguna parte—
   * y dos totales distintos del mismo dato obligan a desconfiar de los dos.
   */
  total?: string
}) {
  // Solo las partes que tienen algo. Un cero no es una astilla de color: una
  // línea de un pixel se lee como «hay poquito», que no es «no hay».
  const PASO = ESCALA[escala]
  const conValor = partes.filter((p) => p.valor > 0)
  const suma = conValor.reduce((a, p) => a + p.valor, 0)

  return (
    <div className="grid gap-3">
      {total ? (
        <p className="aq-cifra text-[30px] leading-none font-semibold tracking-tight text-principal">
          {total}
        </p>
      ) : null}

      {conValor.length > 0 ? (
        <div data-barra aria-hidden="true" className="flex h-3.5 gap-0.5">
          {conValor.map((parte, i) => (
            <span
              key={parte.etiqueta}
              data-segmento
              /*
                El hueco de 2 px entre segmentos no es decoración: separa dos
                pasos vecinos de la misma rampa, que si se tocan se leen como un
                degradado continuo en vez de como dos tramos.
              */
              className={`${PASO[Math.min(i, PASO.length - 1)]} first:rounded-l-sm last:rounded-r-sm`}
              style={{ width: `${porcentaje(parte.valor, suma)}%` }}
            />
          ))}
        </div>
      ) : null}

      {conValor.length > 0 ? (
        <ul className="grid gap-1">
          {conValor.map((parte, i) => (
            <li key={parte.etiqueta} className="flex items-baseline gap-2.5 text-[13.5px]">
              <span
                aria-hidden
                className={`${PASO[Math.min(i, PASO.length - 1)]} size-2.5 shrink-0 translate-y-0.5 rounded-xs`}
              />
              <span className="min-w-0 truncate text-secundario">{parte.etiqueta}</span>
              <span className="aq-cifra ml-auto shrink-0 text-[13px] text-principal">
                {parte.texto}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Un decimal: `51.3%` y `51.2765957%` se ven igual, y el segundo hace que
 *  cualquier prueba del valor dependa de la coma flotante. */
function porcentaje(valor: number, suma: number): string {
  if (suma <= 0) return '0'

  return Number(((valor / suma) * 100).toFixed(1)).toString()
}
