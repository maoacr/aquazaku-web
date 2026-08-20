/**
 * Layout de las pantallas SIN sesión: login y recuperación de contraseña.
 *
 * Es el complemento de `(app)/layout.tsx`. Ese exige sesión y redirige a
 * `/login`; este no puede exigirla, porque es donde se entra. Tenerlos
 * separados es justamente para qué sirven los route groups: dos layouts
 * distintos sobre el mismo nivel de URL.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
