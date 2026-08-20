import { AltaDeUsuario } from '@/components/usuarios/alta-usuario'
import { TablaDeUsuarios } from '@/components/usuarios/tabla-usuarios'
import { apiServerFetch } from '@/lib/api-server'
import type { UsuarioListado } from '@/lib/api-types'

/**
 * Administración de usuarios — solo `admin`.
 *
 * El acceso lo decide `api/`: si un rol sin permiso llega hasta acá,
 * `apiServerFetch` recibe 403 y lanza. Ocultar el link del sidebar es
 * cosmética (RN-ACC-02); esta página no vuelve a chequear el rol porque hacerlo
 * sugeriría que ESA es la barrera.
 *
 * Los roles vienen en la misma respuesta que los usuarios, así la tabla se
 * arma con un solo viaje a `api/`.
 */
export default async function UsuariosPage() {
  const usuarios = await apiServerFetch<UsuarioListado[]>('/users')

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Altas, roles y estado. Todo cambio queda registrado en la auditoría.
        </p>
      </header>

      <AltaDeUsuario />

      <TablaDeUsuarios usuarios={usuarios} />
    </div>
  )
}
