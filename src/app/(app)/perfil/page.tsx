import { KeyRound } from 'lucide-react'
import Link from 'next/link'
import { SelectorTema } from '@/components/ui/selector-tema'
import { getServerUser } from '@/lib/api-server'
import { leerTema } from '@/lib/tema'

const ROL_EXPLICADO: Record<string, string> = {
  admin: 'Configuración, auditoría y ajustes sensibles',
  seller: 'Contacta clientes y registra ventas',
  pos: 'Planta y mostrador: venta, despacho y cierre de producción',
  contador: 'Solo lectura, para temas impositivos',
}

/**
 * Los datos de quien entró.
 *
 * Muestra lo que el sistema sabe de la persona y lo que puede cambiar por su
 * cuenta. Los roles se ven pero **no se editan acá**: los asigna un `admin`
 * desde Usuarios, y dejarlos editables sugeriría que uno puede darse permisos.
 *
 * Acá vive también la preferencia de tema completa, con las tres opciones. El
 * header tiene el atajo claro ↔ oscuro; volver a «seguir al sistema» es una
 * decisión de fondo y no algo que se toque de paso.
 */
export default async function PerfilPage() {
  const [usuario, tema] = await Promise.all([getServerUser(), leerTema()])

  if (!usuario) return null

  return (
    <div className="grid max-w-2xl gap-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-principal sm:text-[32px] sm:leading-10">
          {usuario.name}
        </h1>
        <p className="mt-1 text-secundario">{usuario.email}</p>
      </header>

      <section className="grid gap-3 rounded-lg border border-sutil bg-tarjeta p-5">
        <h2 className="aq-micro text-secundario">Qué puede hacer</h2>

        {/*
          Los roles se suman, no se eligen: quien tiene dos ve los módulos de
          los dos a la vez (RN-ACC-01). Por eso se listan todos con lo que
          habilita cada uno, en vez de mostrar «rol activo».
        */}
        <ul className="grid gap-2">
          {usuario.roles.map((rol) => (
            <li key={rol} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-principal">{rol}</span>
              <span className="text-[14px] text-secundario">{ROL_EXPLICADO[rol] ?? ''}</span>
            </li>
          ))}
        </ul>

        <p className="text-[13px] text-tenue">
          Los roles los asigna un administrador desde Usuarios. No se cambian desde acá.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-sutil bg-tarjeta p-5">
        <h2 className="aq-micro text-secundario">Apariencia</h2>
        <SelectorTema actual={tema} />
        <p className="text-[13px] text-tenue">
          «Sistema» sigue lo que tenga configurado en su computador o teléfono.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-sutil bg-tarjeta p-5">
        <h2 className="aq-micro text-secundario">Seguridad</h2>
        <Link
          href="/change-password"
          className="flex min-h-11 w-fit items-center gap-2 rounded-md bg-accion px-4 font-medium text-invertido hover:bg-accion-hover"
        >
          <KeyRound aria-hidden className="size-4" />
          Cambiar mi contraseña
        </Link>
        <p className="text-[13px] text-tenue">
          Cambiarla cierra todas sus sesiones abiertas, también en otros dispositivos.
        </p>
      </section>
    </div>
  )
}
