import Link from 'next/link'

/**
 * Una barra de pestañas cuyo estado vive en la URL.
 *
 * ── Por qué la URL y no `useState` ──────────────────────────────────────────
 *
 * La pestaña activa es un `<Link>`, no un botón con estado. Eso hace tres cosas
 * gratis: la página se puede refrescar sin perder el lugar, el link se puede
 * compartir, y el componente sigue siendo Server Component — cero JavaScript
 * al browser para algo que es navegación.
 *
 * ── Por qué vive en `ui/` ───────────────────────────────────────────────────
 *
 * Nació en `ventas/pestanas-de-ventas.tsx`. Cuando Seguimientos necesitó lo
 * mismo, la opción era copiar treinta líneas de markup idéntico. Dos copias de
 * una barra de pestañas se separan solas: alguien arregla el foco en una y la
 * otra queda vieja, y nadie se entera porque las dos «funcionan».
 *
 * Acá vive el ASPECTO y el comportamiento del link. Los nombres de las
 * pestañas, el parámetro de la query y cuál es la de por defecto los pone cada
 * módulo, que es el que sabe de qué está hablando.
 */

export interface Pestana {
  /** El valor que viaja en la query string. */
  valor: string
  etiqueta: string
  conteo: number
}

export function Pestanas({
  etiquetaDelGrupo,
  param,
  porDefecto,
  activa,
  basePath,
  pestanas,
}: {
  /** Qué está filtrando esta barra — lo lee el lector de pantalla. */
  etiquetaDelGrupo: string
  /** El nombre del parámetro en la URL: `tab`, `canal`… */
  param: string
  /** El valor que NO se escribe en la URL, para dejarla limpia en el caso común. */
  porDefecto: string
  activa: string
  basePath: string
  pestanas: Pestana[]
}) {
  return (
    <nav
      role="tablist"
      aria-label={etiquetaDelGrupo}
      className="flex flex-wrap gap-1 border-b border-sutil"
    >
      {pestanas.map((p) => (
        <Link
          key={p.valor}
          /*
           * La pestaña por defecto apunta a la URL sin parámetro: deja el caso
           * común limpio y evita que compartir el link arrastre un `?tab=…` que
           * no aporta nada.
           */
          href={p.valor === porDefecto ? basePath : `${basePath}?${param}=${p.valor}`}
          role="tab"
          aria-selected={p.valor === activa}
          className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${
            p.valor === activa
              ? 'border-principal text-principal'
              : 'border-transparent text-tenue hover:text-principal'
          }`}
        >
          {p.etiqueta}{' '}
          {/*
            El conteo llega como prop, no se pide aparte: ya viene del servidor
            junto con la lista, y un viaje extra para saber cuántas hay sería
            solo para mostrar un número que ya se conoce.
          */}
          <span className="ml-1 rounded-full bg-elevada px-2 py-0.5 text-[12px] text-tenue">
            {p.conteo}
          </span>
        </Link>
      ))}
    </nav>
  )
}
