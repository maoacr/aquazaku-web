/**
 * Error de un formulario de auth.
 *
 * `role="alert"` hace que un lector de pantalla lo anuncie apenas aparece, sin
 * que el usuario tenga que salir a buscarlo. El `id` se expone para que los
 * campos lo referencien con `aria-describedby`.
 */
export function FormError({ id, children }: { id: string; children?: string }) {
  if (!children) return null

  return (
    <p id={id} role="alert" className="text-sm text-red-600">
      {children}
    </p>
  )
}
