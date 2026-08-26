import { AltaDeUsuario } from '@/components/usuarios/alta-usuario'
import { TarjetasDeUsuarios } from '@/components/usuarios/tarjetas-de-usuarios'
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
 * Los roles vienen en la misma respuesta que los usuarios, así la lista se arma
 * con un solo viaje a `api/` — y por eso el filtro puede ser del cliente.
 *
 * La lista sirve para ENCONTRAR a alguien. Repartir roles, desactivar y
 * restablecer la contraseña viven en `/modulos/usuarios/[id]`: eran una celda de
 * tabla con cuatro casillas y dos botones, que en un teléfono obligaba a
 * scrollear en horizontal para llegar a la acción.
 */
export default async function UsuariosPage() {
  const usuarios = await apiServerFetch<UsuarioListado[]>('/users')

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Usuarios</h1>
        <p className="mt-1 text-sm text-tenue">
          Altas, roles y estado. Todo cambio queda registrado en la auditoría.
        </p>
      </header>

      <AltaDeUsuario />

      <TarjetasDeUsuarios usuarios={usuarios} />
    </div>
  )
}
