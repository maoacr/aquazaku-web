'use client'

import { statusDesdeDigest } from '@/lib/errors'

/**
 * Qué ve el usuario cuando una pantalla de la app falla.
 *
 * Vive en `(app)` para cubrir todos los módulos de una vez: una pantalla nueva
 * nace con manejo de errores sin que su autor tenga que acordarse.
 *
 * ── Por qué mira el `digest` y no el mensaje ─────────────────────────────────
 *
 * En producción Next borra `message` y `stack` antes de mandar el error al
 * browser, para no filtrar detalles del servidor. Lo único que sobrevive es
 * `digest`. `ApiError` lo usa para transportar el status, así el boundary puede
 * distinguir "no tenés permiso" de "se cayó api/" — que son dos situaciones muy
 * distintas para quien está del otro lado de la pantalla.
 */
export default function ErrorDeApp({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const status = statusDesdeDigest(error.digest)

  if (status === 403) {
    return (
      <Aviso titulo="No tenés acceso a esta sección">
        <p>
          Tu usuario no tiene permiso para ver esta pantalla. Si creés que debería tenerlo, pedile a
          un administrador que revise tus roles.
        </p>
        {/* Se avisa que quedó registrado: es cierto —`requirePermission` audita
            todos los denegados— y desalienta insistir. */}
        <p className="text-tenue">El intento quedó registrado en la auditoría.</p>
      </Aviso>
    )
  }

  return (
    <Aviso titulo="Algo se rompió de nuestro lado">
      <p>No pudimos cargar esta pantalla. Probá de nuevo en un momento.</p>
      {error.digest ? (
        // El digest es lo que permite encontrar este error exacto en los logs.
        // Sin él, un reporte de usuario es "no andaba" y no hay por dónde
        // empezar a buscar.
        <p className="text-tenue">
          Si vuelve a pasar, pasale este código a soporte:{' '}
          <code className="font-mono text-secundario">{error.digest}</code>
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-2 justify-self-start rounded border border-fuerte px-4 py-2 text-sm"
      >
        Reintentar
      </button>
    </Aviso>
  )
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div role="alert" className="grid max-w-prose gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <div className="grid gap-2 text-sm text-secundario">{children}</div>
    </div>
  )
}
