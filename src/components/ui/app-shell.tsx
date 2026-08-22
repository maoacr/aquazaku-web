import { Home } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CabeceraYMenu } from '@/components/ui/cajon-navegacion'
import { EnlaceDeMenu } from '@/components/ui/enlace-de-menu'
import { AccionesDeSesion } from '@/components/ui/acciones-de-sesion'
import { Marca } from '@/components/ui/marca'
import { Creditos, Pie } from '@/components/ui/pie'
import { computeVisibleModules } from '@/lib/modules'
import type { Role } from '@/lib/roles'

/**
 * Armazón de la app: cabecera, menú, contenido y pie.
 *
 * ── Un grid con áreas nombradas ─────────────────────────────────────────────
 *
 *   teléfono            escritorio
 *   ┌──────────┐        ┌──────┬──────────┐
 *   │ cabecera │        │   cabecera      │
 *   ├──────────┤        ├──────┼──────────┤
 *   │ contenido│        │ menú │ contenido│
 *   ├──────────┤        ├──────┴──────────┤
 *   │   pie    │        │      pie        │
 *   └──────────┘        └─────────────────┘
 *
 * El grid resuelve de una vez tres cosas que antes estaban peleadas: el pie
 * siempre visible, el menú a altura completa y el scroll encerrado en el
 * contenido. `grid-rows: auto 1fr auto` hace que solo la fila del medio ceda,
 * y `min-h-0` en el `<main>` permite que se encoja para que el scroll viva ahí
 * y no se escape al documento.
 *
 * En teléfono el menú sale del grid —pasa a `fixed` y se desplaza— pero sigue
 * siendo **el mismo nodo**. La versión anterior renderizaba el menú dos veces
 * para esquivar un comportamiento del navegador; esto no duplica nada.
 */
export function AppShell({
  userRoles,
  userName,
  children,
}: {
  userRoles: Role[]
  userName: string
  children: ReactNode
}) {
  const modules = computeVisibleModules(userRoles)

  return (
    /*
     *   teléfono              escritorio
     *   ┌──────────┐          ┌──────┬──────────┐
     *   │ cabecera │          │   cabecera      │
     *   ├──────────┤          ├──────┼──────────┤
     *   │ contenido│          │ menú │ contenido│
     *   ├──────────┤          ├──────┴──────────┤
     *   │   pie    │          │      pie        │
     *   └──────────┘          └─────────────────┘
     *
     * En teléfono el menú sale del grid —pasa a `fixed` y se desplaza— pero
     * sigue siendo el mismo nodo. Nada se renderiza dos veces.
     */
    <div className="aq-ambiente aq-armazon grid h-dvh">
      <CabeceraYMenu
        marca={<EnlaceDeMarca />}
        /*
          Las dos usan el mismo gradiente. Antes la del panel forzaba la cinta
          clara porque el menú era oscuro en los dos modos; ahora el menú es
          vidrio sobre el agua y sigue al tema, así que el nombre también.
        */
        marcaDelPanel={<EnlaceDeMarca />}
        acciones={<AccionesDeSesion nombre={userName} />}
        menu={<MenuLateral modules={modules} />}
        roles={userRoles}
        creditos={<Creditos />}
      />

      <main
        style={{ gridArea: 'contenido' }}
        // `min-h-0` es lo que permite que un hijo de grid se encoja. Sin él el
        // contenido empuja al contenedor y el scroll se escapa al documento,
        // arrastrando el menú y el pie con él.
        className="min-h-0 overflow-y-auto"
      >
        {children}
      </main>

      <Pie />
    </div>
  )
}

/** Contenido del menú: solo navegación. Lo demás vive en la cabecera. */
/**
 * La marca, enlazada al inicio.
 *
 * Es la convención de la web y el atajo que todo el mundo prueba primero. Se
 * pinta dos veces —cabecera en teléfono, panel en escritorio— y cada una elige
 * su gradiente según la superficie donde se apoya.
 */
function EnlaceDeMarca({ sobreOscuro = false }: { sobreOscuro?: boolean }) {
  return (
    <Link
      href="/"
      // Medía 36 px de alto. Es el atajo al tablero, un objetivo suelto.
      className="inline-flex min-h-11 items-center rounded-md px-1"
      aria-label="Ir al inicio"
    >
      <Marca compacta sobreOscuro={sobreOscuro} />
    </Link>
  )
}

function MenuLateral({ modules }: { modules: ReturnType<typeof computeVisibleModules> }) {
  return (
    <ul
      // El `p-[5px]` no es estético: es el lugar que necesita el anillo de foco.
      // `overflow-y-auto` recorta lo que se salga de la caja, y el anillo sale
      // 5 px —2 de separación más 3 de grosor—, así que sin ese aire el primer y
      // el último ítem se quedan sin la mitad del anillo. Medido, no supuesto.
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-[5px]"
    >
      {/*
        Inicio va explícito y no solo en la marca. Confiar en que «el logo
        lleva al inicio» es una convención de quien vive en la web; alguien
        que atiende un mostrador merece un link que lo diga.
      */}
      <li>
        <EnlaceDeMenu href="/" icono={<Home aria-hidden className="size-4 shrink-0" />}>
          Inicio
        </EnlaceDeMenu>
      </li>

      {modules.map((modulo) => (
        <li key={modulo.id}>
          <EnlaceDeMenu
            href={modulo.href}
            icono={<modulo.icono aria-hidden className="size-4 shrink-0" />}
          >
            {modulo.label}
          </EnlaceDeMenu>
        </li>
      ))}
    </ul>
  )
}
