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
        { valor: 'botellones', etiqueta: 'Recarga de botellones', conteo: conteos.botellones },
        { valor: 'otros', etiqueta: 'Otros productos', conteo: conteos.otros },
      ]}
    />
  )
}
