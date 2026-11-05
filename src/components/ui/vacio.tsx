import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * R50 · Tres vacíos, no uno.
 *
 * ```
 * dado    una lista sin elementos
 * entonces el mensaje distingue si nunca hubo, si el filtro no encontró, o si
 *          ya se terminó lo que había
 * ```
 *
 * Parece una sutileza y no lo es. Los tres se ven igual —una lista sin nada— y
 * significan cosas opuestas:
 *
 * **`primera-vez`** · nunca hubo nada. La persona no hizo nada mal y lo que
 * necesita es empezar, así que acá sí va la acción de crear.
 *
 * **`sin-resultados`** · hay datos, pero el filtro no los alcanza. **Acá está la
 * regla dura: nunca ofrecer crear.** Ofrecerlo empuja a cargar un producto que
 * ya existe porque se lo buscó con un filtro equivocado — y ese duplicado
 * después hay que descubrirlo y limpiarlo. Lo que corresponde es quitar el
 * filtro.
 *
 * **`terminado`** · había y se acabó, y eso es una buena noticia: no queda nada
 * pendiente. Un «no hay resultados» acá se lee como una falla cuando en realidad
 * es que el trabajo está al día.
 */
export function Vacio(props: PropsDeVacio) {
  const { variante, icono: Icono, titulo, children } = props

  /*
   * La acción de `sin-resultados` NO la elige quien lo usa: la arma el
   * componente. Es la única forma de garantizar que ahí nunca aparezca un
   * «crear», y el tipo hace que ni siquiera se pueda intentar.
   */
  const accion =
    variante === 'sin-resultados' ? (
      /*
       * Dos salidas, y el orden importa.
       *
       * Cuando se sabe DÓNDE está lo que se busca, esa es la acción que
       * resuelve: va primera y va primaria. «Quitar los filtros» queda como la
       * salida de siempre —secundaria— porque vuelve a una lista completa que
       * igual hay que recorrer a ojo.
       *
       * `tambienEn` NO es un `accion` libre: es una ruta y una etiqueta. La
       * garantía de esta variante sigue en pie —acá no se puede ofrecer
       * «crear»— y sigue siendo el tipo el que la sostiene, no un comentario.
       */
      <div className="flex flex-wrap items-center justify-center gap-2">
        {props.tambienEn ? <IrA {...props.tambienEn} /> : null}
        <QuitarFiltros href={props.hrefSinFiltros} />
      </div>
    ) : (
      props.accion
    )

  return (
    <div
      // `status` y no `alert`: que una lista esté vacía es información, no una
      // emergencia. `alert` interrumpe lo que el lector de pantalla esté
      // diciendo, y esto no lo amerita.
      role="status"
      className="grid justify-items-center gap-3 aq-tarjeta px-6 py-14 text-center"
    >
      <Icono aria-hidden className={`size-8 ${TONO_DEL_ICONO[variante]}`} />

      <p className="text-[17px] font-medium text-principal">{titulo}</p>

      {children ? <div className="max-w-prose text-sm text-secundario">{children}</div> : null}

      {accion}
    </div>
  )
}

export type VarianteDeVacio = 'primera-vez' | 'sin-resultados' | 'terminado'

interface Comunes {
  icono: LucideIcon
  titulo: string
  children?: ReactNode
}

/**
 * Las props, como unión discriminada — y esa es la parte importante.
 *
 * `sin-resultados` **no acepta `accion`**. Pide una ruta sin filtros y arma el
 * enlace por su cuenta, así que ofrecer «crear» en un vacío de filtro deja de
 * ser un error de criterio para ser un error de compilación.
 *
 * Escribir la regla en un comentario no alcanzaba: el día que alguien tenga una
 * lista filtrada vacía y un botón de «nuevo producto» a mano, la tentación de
 * ponerlo ahí es enorme y el resultado son productos duplicados que después hay
 * que descubrir y limpiar.
 */
export type PropsDeVacio =
  | (Comunes & { variante: 'primera-vez'; accion?: AccionDeVacio })
  | (Comunes & { variante: 'terminado'; accion?: AccionDeVacio })
  | (Comunes & {
      variante: 'sin-resultados'
      hrefSinFiltros: string
      /**
       * Dónde SÍ está lo que se busca, cuando se puede saber.
       *
       * Nace del buscador de Seguimientos: sus dos pestañas son dos relojes
       * distintos, así que una dirección puede no estar acá y estar a un clic.
       * Decir solo «ninguna coincide» ahí es cierto y es inútil.
       *
       * Es una ruta y una etiqueta a propósito, y no un nodo: con un nodo libre
       * esta variante volvería a aceptar cualquier botón —incluido un «crear»—
       * y se perdería lo único que R50 garantiza por tipo.
       */
      tambienEn?: { href: string; etiqueta: string }
    })

/**
 * El icono de `terminado` va en verde: es el único de los tres que da una buena
 * noticia. Los otros dos son neutros — no pasó nada malo, simplemente no hay.
 */
const TONO_DEL_ICONO: Record<VarianteDeVacio, string> = {
  'primera-vez': 'text-tenue',
  'sin-resultados': 'text-tenue',
  terminado: 'text-exito',
}

/**
 * La acción de un vacío, ya renderizada por quien lo usa.
 *
 * Se recibe como nodo y no como `{ texto, href }` porque las tres variantes
 * llevan cosas distintas —un link, un botón de formulario, un reset de
 * filtros—, y encajarlas en una sola forma obligaría a un prop por caso.
 */
export type AccionDeVacio = ReactNode

/**
 * El link que quita los filtros. Es la ÚNICA acción que corresponde en un
 * `sin-resultados`, y existe como componente para que quede una sola forma de
 * escribirlo y no diez textos distintos para lo mismo.
 */
/**
 * El link a donde SÍ está lo que se buscaba.
 *
 * Primario porque es la acción que resuelve el problema: quitar los filtros
 * devuelve una lista completa que igual hay que recorrer a ojo.
 */
function IrA({ href, etiqueta }: { href: string; etiqueta: string }) {
  return (
    <a href={href} className="aq-boton aq-boton-primario">
      <ArrowRight aria-hidden className="size-4" />
      Ver en {etiqueta}
    </a>
  )
}

export function QuitarFiltros({ href }: { href: string }) {
  return (
    <a
      href={href}
      // Enlace con forma de botón: es una acción suelta, lleva el objetivo
      // táctil mínimo (R54).
      className="aq-boton aq-boton-secundario"
    >
      Quitar los filtros
    </a>
  )
}
