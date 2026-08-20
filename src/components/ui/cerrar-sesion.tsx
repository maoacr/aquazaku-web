import { cerrarSesionAction } from '@/app/(app)/actions'

/**
 * Botón de salida.
 *
 * Es un `form` con Server Action y no un link: cerrar sesión cambia estado del
 * servidor, y un `GET` desde un link lo dejaría expuesto a que cualquier imagen
 * o prefetch lo dispare sin que la persona lo pida.
 *
 * No necesita `useActionState` —no hay error que mostrar, el resultado es un
 * redirect—, así que se queda como Server Component: cero JavaScript.
 */
export function CerrarSesion({ nombre }: { nombre: string }) {
  return (
    <form action={cerrarSesionAction} className="mt-auto border-t border-neutral-800 pt-4">
      <p className="truncate px-2 text-xs text-neutral-500" title={nombre}>
        {nombre}
      </p>
      <button
        type="submit"
        className="mt-1 w-full rounded p-2 text-left text-sm hover:bg-neutral-900"
      >
        Cerrar sesión
      </button>
    </form>
  )
}
