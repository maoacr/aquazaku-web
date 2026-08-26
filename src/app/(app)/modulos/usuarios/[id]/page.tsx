import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Etiqueta } from '@/components/ui/tabla'
import { AccionesDeUsuario } from '@/components/usuarios/acciones-de-usuario'
import { RestablecerPassword } from '@/components/usuarios/restablecer-password'
import { apiServerFetch } from '@/lib/api-server'
import type { UsuarioListado } from '@/lib/api-types'

/**
 * Un usuario en detalle.
 *
 * Existe porque la lista pasó a ser tarjetas: una tarjeta muestra lo que sirve
 * para ENCONTRAR a alguien —nombre, email, roles, estado— y todo lo demás
 * necesita su propia pantalla. Meterlo en la tarjeta la volvería una fila de
 * tabla con bordes redondeados.
 *
 * El acceso lo decide `api/`: si un rol sin permiso llega hasta acá,
 * `apiServerFetch` recibe 403 y lanza. Esta página no vuelve a chequear el rol
 * porque hacerlo sugeriría que ESA es la barrera (RN-ACC-02).
 */
export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuario = await apiServerFetch<UsuarioListado>(`/users/${id}`)

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <Link
          href="/modulos/usuarios"
          className="inline-flex min-h-11 items-center gap-1.5 text-[14px] text-secundario hover:text-principal"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Volver a usuarios
        </Link>

        <h1 className="aq-titulo-pantalla mt-2 text-principal">{usuario.name}</h1>

        {/* Mono: el email es el identificador con el que entra, y se compara
            carácter a carácter. No es prosa. */}
        <p className="aq-cifra mt-1 text-[14px] text-tenue">{usuario.email}</p>
      </header>

      <section className="aq-tarjeta grid gap-4 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">Acceso</h2>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <dt className="aq-micro text-tenue">Estado</dt>
            <dd>
              <Etiqueta tono={usuario.status === 'active' ? 'ok' : 'neutro'}>
                {usuario.status === 'active' ? 'Activo' : 'Inactivo'}
              </Etiqueta>
            </dd>
          </div>

          <div className="grid gap-1.5">
            <dt className="aq-micro text-tenue">Contraseña</dt>
            <dd className="text-[14px] text-principal">
              {usuario.mustChangePassword
                ? 'Pendiente de cambiar en el próximo ingreso'
                : 'Elegida por la persona'}
            </dd>
          </div>

        </dl>
      </section>

      <AccionesDeUsuario usuario={usuario} />

      <RestablecerPassword userId={usuario.id} nombre={usuario.name} />
    </div>
  )
}
