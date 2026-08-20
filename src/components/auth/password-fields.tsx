/**
 * Par contraseña nueva + confirmación.
 *
 * Lo comparten resetear y cambiar. La confirmación no es ceremonia: en un campo
 * enmascarado un typo no se ve, y sin confirmar el usuario queda afuera de su
 * cuenta con una contraseña que nunca quiso.
 */
export function PasswordFields({ describedBy }: { describedBy?: string }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña nueva
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby={describedBy}
          className="rounded border border-neutral-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Repetí la contraseña nueva
        <input
          name="confirmacion"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby={describedBy}
          className="rounded border border-neutral-300 p-2"
        />
      </label>
    </>
  )
}
