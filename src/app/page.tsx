/**
 * Landing provisoria.
 *
 * Cuando M0 tenga sesión (Task 11), esta ruta pasa a redirigir: a `/dashboard`
 * si hay sesión válida, a `/login` si no. Hasta entonces es solo una señal de
 * vida del proyecto.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Aquazaku</h1>
      <p className="text-sm text-neutral-500">Sistema de gestión</p>
      <p className="max-w-md text-sm text-neutral-400">
        Módulo M0 — Auth y RBAC en construcción.
      </p>
    </main>
  )
}
