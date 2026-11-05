'use client'

import { RotateCcw, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import {
  type FilaDeSeguimiento,
  mostrarEnSeguimientosAction,
  ocultarDeSeguimientosAction,
} from '@/app/(app)/modulos/seguimientos/actions'

/**
 * Sacar una fila de la lista de seguimientos, y devolverla — RN-CLI-18.
 *
 * ── Qué problema resuelve ───────────────────────────────────────────────────
 *
 * La lista es el padrón completo: entra todo el que alguna vez compró. Eso es a
 * propósito, pero deja filas que la operación sabe que no hay que llamar —el
 * que avisó que se muda, el local que cerró, el evento de una vez— y conviven
 * con las que sí importan hasta que recorrer la lista deja de valer la pena.
 *
 * ── Confirma al quitar, y NO al devolver ────────────────────────────────────
 *
 * Esto arrancó sin confirmación, con un argumento que parecía bueno: la acción
 * se deshace sola con una venta nueva, así que un diálogo sería ceremonia.
 *
 * El argumento era incompleto. Lo que se deshace solo es el ESTADO, no la
 * consecuencia: entre el clic y la próxima compra de ese cliente pueden pasar
 * semanas, y en el medio nadie lo llama — que es justo el trabajo que esta
 * pantalla existe para que no se pierda. Y la X vive pegada al lápiz, en una
 * columna de iconos que se recorre con el pulgar.
 *
 * Devolver a la lista no se confirma, y la asimetría es el punto: un diálogo
 * frena lo que puede costar un cliente, no lo que lo recupera. Confirmar las
 * dos cosas enseñaría a apretar «Sí» sin leer.
 *
 * ── Por qué no es un `<form action>` ────────────────────────────────────────
 *
 * Son dos botones con la misma forma y distinta acción, dentro de una celda que
 * ya vive en un componente cliente. Con `useTransition` el botón queda
 * deshabilitado mientras la petición viaja, que es lo único que hace falta para
 * que un doble clic no mande dos veces lo mismo.
 */
export function SacarDeLaLista({
  fila,
  nombre,
  estaOculta,
}: {
  fila: FilaDeSeguimiento
  /** Para que el botón y el diálogo digan a QUIÉN: una X sola no lo dice. */
  nombre: string
  /**
   * Si esta fila ya está fuera de la lista.
   *
   * Cambia la acción y el icono: en la vista de ocultas lo que corresponde es
   * devolverla, no ocultarla de nuevo.
   */
  estaOculta: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [enCurso, ejecutar] = useTransition()

  if (estaOculta) {
    return (
      <button
        type="button"
        disabled={enCurso}
        onClick={() => ejecutar(async () => void (await mostrarEnSeguimientosAction(fila)))}
        aria-label={`Devolver ${nombre} a la lista`}
        title={`Devolver ${nombre} a la lista`}
        className="aq-boton-icono text-icono hover:text-principal disabled:opacity-50"
      >
        <RotateCcw aria-hidden className="size-4" />
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        /*
         * El nombre va en el `aria-label` y en el `title`, no en el botón.
         *
         * En una columna de iconos el texto no cabe, pero «quitar» sin sujeto es
         * justo lo que no se puede anunciar: con cuarenta filas, un lector de
         * pantalla diría «quitar» cuarenta veces sin decir a quién.
         */
        aria-label={`Quitar ${nombre} de esta lista`}
        title={`Quitar ${nombre} de esta lista`}
        className="aq-boton-icono text-icono hover:text-principal"
      >
        <X aria-hidden className="size-4" />
      </button>

      {/*
        Se monta recién al abrirlo: montar de nuevo sale más barato que
        acordarse de limpiar, que es lo que `Modal` dice de sí mismo.

        Y nace DENTRO de un `<td>`. El defecto de heredar `white-space: nowrap`
        y `text-align: right` de la celda ya está tapado en `.aq-modal`, que
        declara `normal` y `start` — el arreglo vive en la superficie que no debe
        depender de dónde nació, no en la celda.
      */}
      {confirmando ? (
        <Modal
          abierto
          cerrar={() => setConfirmando(false)}
          titulo={`¿Quitar a ${nombre} de esta lista?`}
        >
          <div className="grid gap-4">
            <div className="grid gap-2 text-[15px] text-secundario">
              {/*
                Lo primero que se dice es lo que NO pasa.
                
                Quien aprieta una X en un sistema de gestión teme haber borrado
                algo. Si la primera línea no lo descarta, la duda se resuelve
                cancelando — y la función no se usa nunca.
              */}
              <p>
                <span className="text-principal">No se borra nada.</span> El cliente sigue
                completo, con sus ventas, sus teléfonos y su deuda. Solo deja de aparecer en esta
                lista.
              </p>
              <p>
                Si registra una venta, <span className="text-principal">vuelve solo</span>. Y
                mientras eso no pase, está en «mostrar clientes ocultos».
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="aq-boton aq-boton-secundario"
              >
                Cancelar
              </button>
              {/*
                El botón dice la acción, no «Sí».
                
                Un «Sí» obliga a volver a leer el título para saber qué se está
                confirmando, y es lo que se aprieta sin leer cuando hay apuro.
              */}
              <button
                type="button"
                disabled={enCurso}
                onClick={() =>
                  ejecutar(async () => {
                    await ocultarDeSeguimientosAction(fila)
                    setConfirmando(false)
                  })
                }
                className="aq-boton aq-boton-primario"
              >
                <X aria-hidden className="size-4" />
                Quitar de la lista
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
