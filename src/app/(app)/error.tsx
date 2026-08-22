'use client'

import Link from 'next/link'
import { TEXTO_DE_ACCION, mensajeDeError } from '@/lib/errores'
import { ApiError, codigoDeSoporte, statusDesdeDigest } from '@/lib/errors'

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
 *
 * ── El texto no se escribe acá ──────────────────────────────────────────────
 *
 * Sale de `errores.ts`, que es el único lugar donde se decide cómo se le habla a
 * una persona de un fallo. Antes estaba acá adentro, y eso significaba que una
 * acción de formulario que fallara sin llegar al boundary tenía que inventar su
 * propio texto — dos vocabularios para lo mismo.
 *
 * Que Next borre el cuerpo en producción no rompe nada: el mapa solo usa el
 * cuerpo para 409 y 422, y esos no llegan por acá — los atrapa el formulario
 * que hizo la acción y los muestra al lado del campo.
 */
export default function ErrorDeApp({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const status = statusDesdeDigest(error.digest)
  const codigo = codigoDeSoporte(error.digest)
  const mensaje = mensajeDeError(
    status === null ? error : new ApiError(status, '', { path: undefined }),
  )

  return (
    <div role="alert" className="grid max-w-prose gap-3">
      <h1 className="aq-titulo-pantalla text-principal">{mensaje.titulo}</h1>

      <p className="text-sm text-secundario">{mensaje.detalle}</p>

      {/* Se avisa que quedó registrado: es cierto —`requirePermission` audita
          todos los denegados— y desalienta insistir. */}
      {status === 403 ? (
        <p className="text-sm text-tenue">El intento quedó registrado en la auditoría.</p>
      ) : null}

      {/*
        El código de soporte es el `requestId`, no el digest entero.
        `aquazaku-api:500` decía «500» —que a la persona no le significa nada, y
        R52 no lo quiere en pantalla— y encima era el MISMO string para todas
        las fallas del sistema: soporte lo buscaba en los logs y encontraba
        cuatrocientas. El `requestId` identifica esta petición y ninguna otra.
      */}
      {codigo ? (
        <p className="text-sm text-tenue">
          Si vuelve a pasar, pasale este código a soporte:{' '}
          <code className="aq-cifra text-secundario">{codigo}</code>
        </p>
      ) : null}

      {/* R52 · UN solo botón primario. */}
      {mensaje.accion === 'entrar' ? (
        <Link
          href="/login"
          className="aq-boton aq-boton-primario mt-2 w-fit"
        >
          {TEXTO_DE_ACCION[mensaje.accion]}
        </Link>
      ) : (
        <button
          type="button"
          onClick={reset}
          className="aq-boton aq-boton-primario mt-2 w-fit"
        >
          {TEXTO_DE_ACCION[mensaje.accion]}
        </button>
      )}
    </div>
  )
}
