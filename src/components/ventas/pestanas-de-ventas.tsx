import { Pestanas } from '@/components/ui/pestanas'

/**
 * Los dos tabs de la lista de últimas ventas — Vigentes y Anuladas.
 *
 * La URL es la fuente de verdad del tab activo, no un estado local del
 * componente. Eso permite refrescar la página o compartir el link sin
 * perder el tab, y la pantalla habla el mismo idioma que el resto del
 * sistema (que ya usa `?tab=…` para navegación por query string).
 *
 * Los dos tabs viven acá y no en `ultimas-ventas.tsx` porque la lista se
 * monta en dos pantallas distintas (la general y la ficha del cliente) y
 * las dos necesitan poder controlar la ruta del link — no es lo mismo
 * `/modulos/ventas?tab=…` que `/modulos/clientes/cli-1?tab=…`.
 *
 * ── Qué quedó acá y qué se fue a `ui/pestanas.tsx` ──────────────────────────
 *
 * El markup de la barra se fue: lo comparte con Seguimientos y dos copias se
 * separan solas. Lo que queda es lo que este módulo SÍ sabe — que las ventas se
 * miran por «vigentes» o «anuladas», que vigentes es el default, y cómo se lee
 * un `?tab=` que llegó escrito a mano.
 */

export type TabDeVentas = 'vigentes' | 'anuladas'

export const TAB_POR_DEFECTO: TabDeVentas = 'vigentes'

export function pestanaDesde(valor: string | undefined): TabDeVentas {
  return valor === 'anuladas' ? 'anuladas' : TAB_POR_DEFECTO
}

export interface ConteosDeVentas {
  vigentes: number
  anuladas: number
}

export function PestanasDeVentas({
  tab,
  conteos,
  basePath,
}: {
  tab: TabDeVentas
  conteos: ConteosDeVentas
  basePath: string
}) {
  return (
    <Pestanas
      etiquetaDelGrupo="Filtrar últimas ventas por estado"
      param="tab"
      porDefecto={TAB_POR_DEFECTO}
      activa={tab}
      basePath={basePath}
      pestanas={[
        { valor: 'vigentes', etiqueta: 'Vigentes', conteo: conteos.vigentes },
        { valor: 'anuladas', etiqueta: 'Anuladas', conteo: conteos.anuladas },
      ]}
    />
  )
}
