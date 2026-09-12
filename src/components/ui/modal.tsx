'use client'

import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

/**
 * Un modal — M14.
 *
 * ── Sobre `<dialog>` nativo, no sobre un div ────────────────────────────────
 *
 * El elemento del navegador ya trae lo que un modal hecho a mano casi siempre
 * olvida: el foco queda atrapado adentro, `Esc` cierra, el fondo deja de ser
 * interactivo para el teclado y para un lector de pantalla, y el navegador lo
 * anuncia como diálogo.
 *
 * Reimplementar eso son doscientas líneas y una lista de detalles que se
 * descubren rotos cuando alguien navega sin mouse. Acá el navegador ya lo hace.
 *
 * ── Se monta solo cuando está abierto ───────────────────────────────────────
 *
 * El contenido va adentro del `{abierto && ...}` a propósito: un formulario que
 * vive escondido conserva lo que alguien escribió y descartó, y reaparece con
 * eso la próxima vez. Montar de nuevo es más barato que acordarse de limpiar.
 */
export function Modal({
  abierto,
  cerrar,
  titulo,
  atras,
  children,
}: {
  abierto: boolean
  cerrar: () => void
  titulo: string
  /**
   * Volver atrás, cuando el contenido tiene pasos — opcional.
   *
   * Va acá y no adentro del contenido porque «atrás» es NAVEGACIÓN, y la
   * navegación se busca arriba a la izquierda, no abajo entre los botones que
   * confirman. Mezclado con «Siguiente» y «Cancelar», retroceder pesaba lo
   * mismo que avanzar y había que leer los tres para elegir.
   */
  atras?: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return

    /*
     * `showModal()` y no el atributo `open`: solo el método activa el fondo
     * inerte y la captura del foco. Con `open` se ve igual y no protege nada.
     */
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      // El `Esc` del navegador cierra sin pasar por el botón: sin esto, el
      // estado de React quedaría diciendo «abierto» sobre un diálogo cerrado.
      onClose={cerrar}
      aria-label={titulo}
      className="aq-modal"
    >
      {abierto ? (
        <div className="grid gap-4 p-5">
          <div className="flex items-center gap-3">
            {atras ? (
              <button
                type="button"
                onClick={atras}
                aria-label="Volver al paso anterior"
                className="aq-boton aq-boton-compacto aq-boton-secundario"
              >
                <ArrowLeft aria-hidden className="size-4" />
              </button>
            ) : null}

            <h2 className="aq-titulo-tarjeta text-principal">{titulo}</h2>

            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="aq-boton aq-boton-compacto aq-boton-secundario ml-auto"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          {children}
        </div>
      ) : null}
    </dialog>
  )
}
