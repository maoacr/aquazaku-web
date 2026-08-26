import type { NivelDeTanque, SaldoDeAgua } from '@/lib/api-types'

/**
 * El tanque, dibujado.
 *
 * ── Por qué marca CUARTOS y no una escala de litros ─────────────────────────
 *
 * Porque «medio tanque» es la unidad en la que la planta piensa. No hay medidor
 * ni regleta (RN-PRD-11): lo que alguien puede afirmar mirando es un cuarto, la
 * mitad, tres cuartos. Un eje graduado de 0 a 13.000 prometería una precisión
 * que nadie tiene, y sería una escala que hay que traducir mentalmente cada vez.
 *
 * Los litros siguen estando —arriba, en cifra— porque el saldo del libro es el
 * que manda (RN-PRD-14). El dibujo es para comparar, no para medir.
 *
 * ── La banda observada es la mitad interesante ──────────────────────────────
 *
 * Cuando el último cierre anotó un nivel visto, se pinta la banda que ese nivel
 * representa. Ahí el gráfico deja de ser un adorno: si la línea del agua cae
 * dentro de la banda, el libro y el ojo dicen lo mismo; si cae afuera, hay algo
 * sin registrar y se ve de un vistazo, sin abrir la reconciliación.
 *
 * ── Es un Server Component ──────────────────────────────────────────────────
 *
 * SVG plano, sin estado ni efectos. Se pinta en el servidor y llega como HTML.
 * Un gráfico que necesita `'use client'` para dibujar una barra manda al browser
 * trabajo que ya estaba hecho.
 */

/** Geometría del dibujo, en unidades del `viewBox`. */
const CAJA = { ancho: 120, alto: 210 }
const CUERPO = { x: 22, ancho: 76, arriba: 26, abajo: 178 }
const TAPA_RY = 9
const ALTO_UTIL = CUERPO.abajo - CUERPO.arriba

/** Las cuatro marcas que el ojo distingue. `lleno` y `vacio` son los bordes. */
const MARCAS: { fraccion: number; texto: string }[] = [
  { fraccion: 0.75, texto: '¾' },
  { fraccion: 0.5, texto: '½' },
  { fraccion: 0.25, texto: '¼' },
]

const TEXTO_DE_NIVEL: Record<NivelDeTanque, string> = {
  vacio: 'vacío',
  un_cuarto: 'un cuarto',
  medio: 'medio',
  tres_cuartos: 'tres cuartos',
  lleno: 'lleno',
}

export interface BandaObservada {
  nivel: NivelDeTanque
  desde: number
  hasta: number
}

/** La altura en el dibujo que corresponde a una fracción de la capacidad. */
function alturaDe(fraccion: number): number {
  return CUERPO.abajo - Math.min(1, Math.max(0, fraccion)) * ALTO_UTIL
}

export function Tanque({
  saldo,
  banda,
  id,
}: {
  saldo: SaldoDeAgua
  /** El nivel que alguien vio, si el último cierre lo anotó. */
  banda?: BandaObservada
  /** Sufijo para los ids del SVG: dos tanques en la misma página los comparten. */
  id: string
}) {
  const fraccion = saldo.capacidad === 0 ? 0 : saldo.litros / saldo.capacidad
  const corto = saldo.litros < 0
  const superficie = alturaDe(fraccion)

  /*
   * Sin agua no se dibuja una lámina de un pixel: se dibuja nada.
   *
   * No hace falta excluir el negativo aparte —una fracción negativa ya no pasa
   * este umbral—. Estaba escrito como `!corto && fraccion > 0.002`, y borrar el
   * `!corto` no rompía ningún test: era una condición que no decidía nada.
   */
  const hayAgua = fraccion > 0.002

  const cuadra =
    banda !== undefined && saldo.litros >= banda.desde && saldo.litros <= banda.hasta

  return (
    <svg
      viewBox={`0 0 ${CAJA.ancho} ${CAJA.alto}`}
      className="h-auto w-full max-w-[150px]"
      role="img"
      aria-label={descripcion(saldo, banda, cuadra)}
    >
      <defs>
        {/*
          El recorte hace que el agua respete la silueta del tanque en vez de
          asomarse por los costados. Se define por instancia: dos tanques en la
          misma página con el mismo id se roban el recorte entre ellos.
        */}
        <clipPath id={`cuerpo-${id}`}>
          <path d={siluetaInterior()} />
        </clipPath>
      </defs>

      {/* La banda observada va DEBAJO del agua: es contexto, no dato. */}
      {banda ? (
        <g clipPath={`url(#cuerpo-${id})`}>
          <rect
            x={CUERPO.x}
            y={alturaDe(banda.hasta / saldo.capacidad)}
            width={CUERPO.ancho}
            height={Math.max(
              1,
              alturaDe(banda.desde / saldo.capacidad) - alturaDe(banda.hasta / saldo.capacidad),
            )}
            className={cuadra ? 'fill-exito' : 'fill-alerta'}
            opacity={0.18}
          />
        </g>
      ) : null}

      {hayAgua ? (
        <g clipPath={`url(#cuerpo-${id})`}>
          <rect
            x={CUERPO.x}
            y={superficie}
            width={CUERPO.ancho}
            height={CUERPO.abajo - superficie + TAPA_RY}
            className="fill-agua"
            opacity={0.35}
          />
          {/* El menisco: una elipse en la superficie da el volumen que una
              línea recta no da, y cuesta una etiqueta. */}
          <ellipse
            cx={CAJA.ancho / 2}
            cy={superficie}
            rx={CUERPO.ancho / 2}
            ry={TAPA_RY}
            className="fill-agua"
            opacity={0.55}
          />
        </g>
      ) : null}

      {/* Las marcas de cuarto, por encima del agua para que no se pierdan. */}
      {MARCAS.map(({ fraccion: f, texto }) => (
        <g key={texto}>
          <line
            x1={CUERPO.x}
            x2={CUERPO.x + CUERPO.ancho}
            y1={alturaDe(f)}
            y2={alturaDe(f)}
            className="stroke-sutil"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={CUERPO.x + CUERPO.ancho + 5}
            y={alturaDe(f) + 3.5}
            className="fill-tenue text-[9px]"
          >
            {texto}
          </text>
        </g>
      ))}

      {/* La silueta, al final: el contorno tiene que quedar sobre todo. */}
      <path
        d={siluetaInterior()}
        className={corto ? 'stroke-alerta' : 'stroke-sutil'}
        fill="none"
        strokeWidth={1.5}
      />
      <ellipse
        cx={CAJA.ancho / 2}
        cy={CUERPO.arriba}
        rx={CUERPO.ancho / 2}
        ry={TAPA_RY}
        fill="none"
        className={corto ? 'stroke-alerta' : 'stroke-sutil'}
        strokeWidth={1.5}
      />

      {/*
        Un saldo negativo NO es un tanque vacío: es un libro al que se le perdió
        una entrada. Dibujarlo vacío diría que no hay agua, que es otra cosa.
      */}
      {corto ? (
        <text
          x={CAJA.ancho / 2}
          y={CUERPO.abajo - ALTO_UTIL / 2}
          textAnchor="middle"
          className="fill-alerta-texto text-[10px] font-medium"
        >
          libro corto
        </text>
      ) : null}

      <text
        x={CAJA.ancho / 2}
        y={CAJA.alto - 4}
        textAnchor="middle"
        className="fill-tenue text-[9px]"
      >
        {saldo.capacidad.toLocaleString('es-CO')} L
      </text>
    </svg>
  )
}

/** Cuerpo recto con la base redondeada: recto para poder comparar alturas. */
function siluetaInterior(): string {
  const { x, ancho, arriba, abajo } = CUERPO
  const derecha = x + ancho

  return [
    `M ${x} ${arriba}`,
    `L ${x} ${abajo}`,
    `A ${ancho / 2} ${TAPA_RY} 0 0 0 ${derecha} ${abajo}`,
    `L ${derecha} ${arriba}`,
    `A ${ancho / 2} ${TAPA_RY} 0 0 0 ${x} ${arriba}`,
    'Z',
  ].join(' ')
}

/**
 * Lo que un lector de pantalla escucha.
 *
 * Dice los números, no la forma: «un dibujo de un tanque» no le sirve a nadie.
 * Y dice si cuadra con lo observado, que es la única conclusión que el dibujo
 * permite sacar de un vistazo.
 */
function descripcion(saldo: SaldoDeAgua, banda: BandaObservada | undefined, cuadra: boolean): string {
  const base =
    saldo.litros < 0
      ? `El libro quedó corto en ${Math.abs(saldo.litros).toLocaleString('es-CO')} litros`
      : `${saldo.litros.toLocaleString('es-CO')} de ${saldo.capacidad.toLocaleString('es-CO')} litros, ${TEXTO_DE_NIVEL[saldo.nivelCalculado]}`

  if (!banda) return `${base}.`

  return cuadra
    ? `${base}. Coincide con el nivel observado: ${TEXTO_DE_NIVEL[banda.nivel]}.`
    : `${base}. No coincide con el nivel observado, que fue ${TEXTO_DE_NIVEL[banda.nivel]}.`
}
