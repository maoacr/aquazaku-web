import { LogOut, Moon, Sun, UserRound } from 'lucide-react'
import Link from 'next/link'
import { cerrarSesionAction } from '@/app/(app)/actions'
import { cambiarTemaAction } from '@/app/actions-tema'
import { CabeceraAlScroll } from '@/components/ui/cabecera-al-scroll'

/**
 * Los tres controles de la persona que entró: perfil, tema y salida.
 *
 * Van juntos y a la derecha de la cabecera porque es donde se los busca. Antes
 * vivían al pie del menú lateral, que en un teléfono está detrás de un cajón:
 * cambiar el tema exigía abrir el menú, bajar y cerrar.
 *
 * Los tres son iconos de 44 px con su etiqueta accesible. A ese tamaño el texto
 * no entra sin apretar todo, y son tres acciones que se reconocen por su forma.
 */
export function AccionesDeSesion({ nombre }: { nombre: string }) {
  return (
    /*
      La lámina aparece SOLO al scrollear. Arriba de todo los tres controles
      flotan sobre la misma agua que el contenido; cuando el contenido pasa por
      debajo, la lámina es lo que los separa de lo que se desplaza.
    */
    <CabeceraAlScroll>
      <Link
        href="/perfil"
        className={estilo}
        // El nombre va en el título y no en pantalla: en un teléfono, un nombre
        // largo empuja los otros dos controles fuera de la cabecera.
        title={nombre}
        aria-label={`Perfil de ${nombre}`}
      >
        <UserRound aria-hidden className="size-5" />
      </Link>

      <ToggleDeTema />

      {/*
        Cerrar sesión es un `form` y no un link: cambia estado del servidor, y
        un `GET` lo dejaría expuesto a que un prefetch lo dispare sin que nadie
        lo pida.
      */}
      <form action={cerrarSesionAction} className="contents">
        <button type="submit" className={estilo} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut aria-hidden className="size-5" />
        </button>
      </form>
    </CabeceraAlScroll>
  )
}

/**
 * Claro ↔ oscuro, en un solo gesto.
 *
 * Se renderizan **los dos** botones y el CSS muestra el que corresponde al tema
 * que se está viendo. Es la única forma de acertar el icono cuando el tema es
 * `sistema` —el servidor no puede saber qué prefiere el sistema operativo de
 * quien mira— sin preguntarlo con JavaScript y arriesgar un destello.
 *
 * El tercer estado, `sistema`, no está acá: vive en el perfil. Es la preferencia
 * de fondo, no algo que se cambie de un toque, y ocupando un botón obligaría a
 * pasar por él cada vez que alguien solo quiere ver claro.
 *
 * `aq-toggle-tema` no es decorativa: es el escalón que le da a las reglas de
 * `globals.css` la especificidad necesaria para ganarle a `.flex`. Sin ella se
 * ven los dos botones a la vez.
 */
function ToggleDeTema() {
  return (
    <form action={cambiarTemaAction} className="contents aq-toggle-tema">
      <button
        type="submit"
        name="tema"
        value="oscuro"
        className={`${estilo} aq-en-claro`}
        aria-label="Cambiar a tema oscuro"
        title="Cambiar a tema oscuro"
      >
        <Moon aria-hidden className="size-5" />
      </button>

      <button
        type="submit"
        name="tema"
        value="claro"
        className={`${estilo} aq-en-oscuro`}
        aria-label="Cambiar a tema claro"
        title="Cambiar a tema claro"
      >
        <Sun aria-hidden className="size-5" />
      </button>
    </form>
  )
}

/** 44 px de objetivo táctil, que es el mínimo del sistema de diseño. */
const estilo =
  'flex size-11 items-center justify-center rounded-md text-secundario hover:bg-fondo hover:text-principal'
