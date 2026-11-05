import { Pestanas } from '@/components/ui/pestanas'

/**
 * Los dos canales de seguimiento — Botellones y Otros productos.
 *
 * ── Por qué son dos y no un filtro ──────────────────────────────────────────
 *
 * Un botellón de 20 L se acaba en una semana. Una paca de 80 bolsas de 100 ml
 * no se consume con esa cadencia. Con un solo contador, la recarga de hace tres
 * días tapaba la paca de hace veinte y esa fila no existía para nadie.
 *
 * Cada canal cuenta SOLO sus propias ventas —el reloj lo saca `api`— así que un
 * mismo cliente puede estar al día en botellones y atrasado en pacas, y aparecer
 * en las dos listas. No es una inconsistencia: son dos preguntas distintas.
 *
 * `otros` es «todo lo que no es una recarga de botellón» y no «pacas». Si un día
 * entra una presentación nueva, cae ahí sin que nadie se acuerde de este archivo.
 */

export type CanalDeSeguimiento = 'botellones' | 'otros'

export const CANAL_POR_DEFECTO: CanalDeSeguimiento = 'botellones'

/**
 * Lee el `?canal=` de la URL.
 *
 * Cualquier cosa que no sea `otros` cae en el default. Una URL escrita a mano
 * —o un link viejo— no puede dejar la pantalla en un estado que no existe.
 */
export function canalDesde(valor: string | undefined): CanalDeSeguimiento {
  return valor === 'otros' ? 'otros' : CANAL_POR_DEFECTO
}

/**
 * Cómo se llama cada canal en la pantalla.
 *
 * Vive acá y no suelto en el JSX porque hay un segundo lugar que lo nombra: el
 * aviso de «esta persona está en la OTRA pestaña». Si las dos frases se
 * escribieran por separado, el día que una pestaña se renombre el aviso
 * mandaría a un lugar que ya no se llama así.
 */
export const ETIQUETA_DE_CANAL: Record<CanalDeSeguimiento, string> = {
  botellones: 'Recarga de botellones',
  otros: 'Otros productos',
}

/** El canal en el que NO está parado quien mira. Son dos: es el otro. */
export function elOtroCanal(canal: CanalDeSeguimiento): CanalDeSeguimiento {
  return canal === 'botellones' ? 'otros' : 'botellones'
}

/**
 * El link a un canal, con un término de búsqueda opcional sembrado.
 *
 * Misma forma que usa `Pestanas`: el canal por defecto no lleva `?canal=`, para
 * que la URL canónica de la pantalla sea una sola.
 *
 * El `q` NO lo escribe el buscador mientras alguien teclea —eso re-ejecutaría
 * la página en cada letra— pero sí viaja en una navegación que YA está
 * ocurriendo. Sembrar el campo al llegar es lo que hace útil al aviso: decir
 * «está en la otra pestaña» y que al llegar haya que escribirlo de nuevo sería
 * media ayuda.
 */
export function rutaDeCanal(
  basePath: string,
  canal: CanalDeSeguimiento,
  consulta?: string,
  /**
   * Ir al listado de las filas que alguien sacó a mano — RN-CLI-18.
   *
   * Vive en la URL y no en un `useState` por lo mismo que la pestaña: es
   * navegación entre dos vistas de lo mismo, así que se comparte, se refresca y
   * el botón de atrás funciona. Y deja la pantalla resolviéndose en el
   * servidor, que es lo que la hace liviana.
   */
  ocultas?: boolean,
): string {
  const params = new URLSearchParams()
  if (canal !== CANAL_POR_DEFECTO) params.set('canal', canal)

  const limpio = consulta?.trim()
  if (limpio) params.set('q', limpio)

  if (ocultas) params.set('ocultas', '1')

  const cola = params.toString()

  return cola === '' ? basePath : `${basePath}?${cola}`
}

export function PestanasDeSeguimientos({
  canal,
  conteos,
  basePath,
}: {
  canal: CanalDeSeguimiento
  conteos: Record<CanalDeSeguimiento, number>
  basePath: string
}) {
  return (
    <Pestanas
      etiquetaDelGrupo="Filtrar seguimientos por tipo de producto"
      param="canal"
      porDefecto={CANAL_POR_DEFECTO}
      activa={canal}
      basePath={basePath}
      pestanas={[
        {
          valor: 'botellones',
          etiqueta: ETIQUETA_DE_CANAL.botellones,
          conteo: conteos.botellones,
        },
        { valor: 'otros', etiqueta: ETIQUETA_DE_CANAL.otros, conteo: conteos.otros },
      ]}
    />
  )
}
