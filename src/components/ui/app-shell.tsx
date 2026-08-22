import { Home } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CabeceraYMenu } from '@/components/ui/cajon-navegacion'
import { CerrarSesion } from '@/components/ui/cerrar-sesion'
import { Marca } from '@/components/ui/marca'
import { Pie } from '@/components/ui/pie'
import { SelectorTema } from '@/components/ui/selector-tema'
import { computeVisibleModules } from '@/lib/modules'
import type { Role } from '@/lib/roles'
import type { Tema } from '@/lib/tema'

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
  tema,
  children,
}: {
  userRoles: Role[]
  userName: string
  tema: Tema
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
    <div className="aq-armazon grid h-dvh">
      <CabeceraYMenu
        marca={
          /* La marca vuelve al inicio: es la convención de la web y el atajo
             que todo el mundo prueba primero. */
          <Link href="/" className="rounded-md px-1 py-1" aria-label="Ir al inicio">
            <Marca compacta />
          </Link>
        }
        menu={<MenuLateral modules={modules} userName={userName} tema={tema} />}
      />

      <main
        style={{ gridArea: 'contenido' }}
        // `min-h-0` es lo que permite que un hijo de grid se encoja. Sin él el
        // contenido empuja al contenedor y el scroll se escapa al documento,
        // arrastrando el menú y el pie con él.
        className="min-h-0 overflow-y-auto p-4 sm:p-6"
      >
        {children}
      </main>

      <Pie />
    </div>
  )
}

/** Contenido del menú. Vive acá para que el cajón sea solo comportamiento. */
function MenuLateral({
  modules,
  userName,
  tema,
}: {
  modules: ReturnType<typeof computeVisibleModules>
  userName: string
  tema: Tema
}) {
  return (
    <>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {/*
          Inicio va explícito y no solo en la marca. Confiar en que «el logo
          lleva al inicio» es una convención de quien vive en la web; alguien
          que atiende un mostrador merece un link que lo diga.
        */}
        <li>
          <Enlace href="/" icono={<Home aria-hidden className="size-4 shrink-0" />}>
            Inicio
          </Enlace>
        </li>

        {modules.map((modulo) => (
          <li key={modulo.id}>
            <Enlace href={modulo.href}>{modulo.label}</Enlace>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid shrink-0 gap-4 border-t border-sutil pt-4">
        <SelectorTema actual={tema} />
        <CerrarSesion nombre={userName} />
      </div>
    </>
  )
}

function Enlace({
  href,
  icono,
  children,
}: {
  href: string
  icono?: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      // El par fondo/texto va junto: cambiar el fondo sin cambiar el texto es
      // como nace un contraste ilegible.
      className="flex min-h-11 items-center gap-2.5 rounded-md px-3 text-[14px] text-principal hover:bg-accion hover:text-invertido"
    >
      {icono}
      {children}
    </Link>
  )
}
