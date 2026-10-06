import { Etiqueta } from '@/components/ui/tabla'

/**
 * Barras horizontales con el nombre adentro y el valor al lado.
 *
 * ── Por qué barras y no una dona ────────────────────────────────────────────
 *
 * Con tres categorías o más, el nombre al lado se lee más rápido que tres
 * colores que hay que ir a buscar a una leyenda. Y hay una razón más dura: la
 * marca de Aquazaku **no da para más de dos series categóricas**. Azul
 * `#1D78B3` y acento `#199990` están a ΔE 7,8 en visión PLENA —no es un tema de
 * daltonismo, se confunden a ojo pelado—, así que una dona de tres porciones
 * tendría dos indistinguibles.
 *
 * Aquí la identidad la lleva la POSICIÓN y el rótulo. El color es uno solo y no
 * codifica nada: es relleno. Esa es la salida correcta cuando la paleta no
 * alcanza, y es la misma que ya tomó `barras-diarias.tsx` al negarse a apilar
 * tres series.
 *
 * ── El orden lo manda quien llama ───────────────────────────────────────────
 *
 * `/reportes/cartera` ya viene por monto y `/reportes/ventas-por-producto` por
 * unidades, los dos con desempate para que el orden sea TOTAL. Si este
 * componente reordenara, habría dos respuestas para «quién va primero» y la de
 * la pantalla taparía la del servidor en silencio.
 *
 * Es un Server Component: sin estado, sin efectos, cero JavaScript al browser.
 */

export interface FilaDeBarra {
  etiqueta: string
  /** El número con el que se calcula la proporción. */
  valor: number
  /**
   * El valor YA FORMATEADO. Viaja aparte del número porque formatear aquí
   * obligaría a pasar también el tipo —no es lo mismo un monto que un conteo—
   * y porque `api/` manda los montos como string para no perder centavos.
   */
  texto: string
  /** Una etiqueta de estado al final de la fila. Opcional. */
  chip?: { texto: string; tono: 'ok' | 'alerta' | 'neutro' }
}

export function BarrasHorizontales({ filas }: { filas: FilaDeBarra[] }) {
  /*
   * Sin filas no se dibuja una lista vacía: un `<ul>` sin `<li>` es un hueco
   * con semántica de lista que un lector de pantalla anuncia igual. Quien llama
   * decide qué poner en su lugar — normalmente `components/ui/vacio.tsx`.
   */
  if (filas.length === 0) return null

  /*
   * ── La proporción sale del MÁXIMO, no de la suma ──────────────────────────
   *
   * Con la suma, tres categorías parejas darían tres barras de un tercio y la
   * tarjeta se vería vacía. Con el máximo, la primera llega al borde y las
   * demás se leen CONTRA ella, que es la comparación que alguien viene a hacer.
   *
   * El `|| 1` evita dividir por cero cuando todo vale cero: ahí todas las
   * barras miden 0 %, que es lo correcto —no hay nada que comparar—.
   */
  const techo = Math.max(...filas.map((f) => f.valor), 0) || 1

  return (
    <ul className="grid gap-1.5">
      {filas.map((fila) => (
        <li key={fila.etiqueta} className="flex items-center gap-3">
          {/*
            `min-w-0` es lo que permite que la pista se encoja. Sin él, el
            `truncate` de la etiqueta no tiene contra qué recortar y la fila
            empuja el ancho de la tarjeta: a 320 px aparece scroll horizontal.
            Medido — no es precaución de más.
          */}
          <div className="relative flex h-[34px] min-w-0 flex-1 items-center overflow-hidden rounded-md bg-elevada">
            <span
              data-relleno
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-md bg-agua/30"
              style={{ width: `${porcentaje(fila.valor, techo)}%` }}
            />
            <span className="relative truncate pl-2.5 text-[13.5px] text-principal">
              {fila.etiqueta}
            </span>
          </div>

          <span className="aq-cifra shrink-0 text-[13px] text-secundario">{fila.texto}</span>

          {fila.chip ? (
            <span className="shrink-0">
              <Etiqueta tono={fila.chip.tono}>{fila.chip.texto}</Etiqueta>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * El ancho de la barra, en porcentaje con un decimal.
 *
 * Un decimal y no más: `53.6%` y `53.5714285%` se ven igual en pantalla, pero
 * el segundo hace que cualquier test de este valor dependa de la aritmética de
 * coma flotante.
 */
function porcentaje(valor: number, techo: number): string {
  // Un negativo no se dibuja hacia atrás: se dibuja como nada. Un saldo en
  // rojo es un caso del dato, no de la barra, y quien llama lo dice con texto.
  if (valor <= 0) return '0'

  return Number(((valor / techo) * 100).toFixed(1)).toString()
}
