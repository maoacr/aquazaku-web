import Link from 'next/link'

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
    <nav
      role="tablist"
      aria-label="Filtrar últimas ventas por estado"
      className="flex flex-wrap gap-1 border-b border-sutil"
    >
      <PestanaDeVentas
        tab="vigentes"
        activa={tab === 'vigentes'}
        conteo={conteos.vigentes}
        basePath={basePath}
      />
      <PestanaDeVentas
        tab="anuladas"
        activa={tab === 'anuladas'}
        conteo={conteos.anuladas}
        basePath={basePath}
      />
    </nav>
  )
}

/**
 * Una tab — un link con el conteo al lado.
 *
 * El conteo llega como prop, no se pide en el cliente: ya viene del
 * servidor junto con la lista, y un round-trip extra para saber
 * cuántas hay hoy sería solo para mostrar un número que ya se conoce.
 *
 * Cuando es el tab por defecto, el link va a la URL sin `?tab=…`:
 * deja la URL limpia para el caso común y evita que la búsqueda y el
 * compartir el link arrastren un parámetro que no aporta.
 */
function PestanaDeVentas({
  tab,
  activa,
  conteo,
  basePath,
}: {
  tab: TabDeVentas
  activa: boolean
  conteo: number
  basePath: string
}) {
  const etiqueta = tab === 'anuladas' ? 'Anuladas' : 'Vigentes'
  const href = tab === TAB_POR_DEFECTO ? basePath : `${basePath}?tab=${tab}`

  return (
    <Link
      href={href}
      role="tab"
      aria-selected={activa}
      className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${
        activa
          ? 'border-principal text-principal'
          : 'border-transparent text-tenue hover:text-principal'
      }`}
    >
      {etiqueta}{' '}
      <span className="ml-1 rounded-full bg-elevada px-2 py-0.5 text-[12px] text-tenue">
        {conteo}
      </span>
    </Link>
  )
}
