'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  editarClienteAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import type { Cliente } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'
import { CamposDeNombre } from './campos-de-nombre'

const INICIAL: EstadoDeFormulario = {}

/**
 * Corregir el nombre de un cliente ya registrado — RN-CLI-17.
 *
 * ── Por qué hacía falta ─────────────────────────────────────────────────────
 *
 * El alta era la única puerta al nombre. Un dedazo en «Padilla» quedaba fijo
 * para siempre, y la salida que encontraba quien atiende el mostrador era
 * registrar al cliente otra vez: dos fichas parten su deuda y sus botellones en
 * dos, y ninguna de las dos es real.
 *
 * ── La forma de los campos sale del DATO, no del tipo ───────────────────────
 *
 * `nombreLibre` es el nombre de un negocio **o el de alguien cargado sin
 * partir**. Un formulario guiado por `cliente.tipo` le pediría a ese residencial
 * primer nombre y apellidos —vacíos—, y como `api/` reemplaza el nombre entero,
 * guardarlo le borraría el único nombre que tiene.
 *
 * ── Se abre con el nombre PUESTO ────────────────────────────────────────────
 *
 * Quien entra acá viene a arreglar una letra. Con los campos en blanco, corregir
 * «Padila» es teclear los cuatro campos de nuevo — y el segundo nombre o el
 * apodo que nadie se acuerde de reescribir se borran de verdad.
 */
export function EditarNombre({ cliente }: { cliente: Cliente }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {/*
        Solo el lápiz. Pegado al nombre, el ícono ya dice qué edita: el contexto
        hace el trabajo que hacía la etiqueta, y el título deja de competir con
        un botón tan ancho como él.

        Pero un ícono no tiene texto, así que el nombre accesible va en
        `aria-label` — y nombra al cliente, porque en esta ficha hay más de un
        lápiz y «Corregir el nombre» a secas no distingue cuál.

        `aq-boton-icono` es lo que lo deja en 44×44: `aq-boton-compacto` conserva
        el alto pero lo angosta a 40 px de ancho, y el pulgar no se achica porque
        el botón no tenga texto.
      */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Corregir el nombre de ${cliente.nombre}`}
        className="aq-boton aq-boton-secundario aq-boton-compacto aq-boton-icono"
      >
        <Pencil aria-hidden className="size-4" />
      </button>

      <Modal abierto={abierto} cerrar={() => setAbierto(false)} titulo={cliente.nombre}>
        <FormularioDeNombre cliente={cliente} alGuardar={() => setAbierto(false)} />
      </Modal>
    </>
  )
}

function FormularioDeNombre({
  cliente,
  alGuardar,
}: {
  cliente: Cliente
  alGuardar: () => void
}) {
  const [estado, accion, enviando] = useActionState(editarClienteAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  /*
   * Cerrar al guardar y NO al fallar. Un modal que se cierra ante un error se
   * lleva puesto lo que la persona escribió, y la deja adivinando qué pasó.
   *
   * ── Por qué en un efecto y no en el cuerpo ────────────────────────────────
   *
   * `alGuardar` es el `setAbierto` del padre. Llamarlo durante el render es
   * actualizar OTRO componente mientras React renderiza este, y React lo
   * rechaza: «Cannot update a component while rendering a different component».
   * En la ficha real esa excepción subía al error boundary, que la mostraba
   * como «No pudimos conectarnos» — con el nombre ya guardado.
   *
   * El token es lo que marca «esta vez sí se guardó», y el `ref` lo dispara una
   * sola vez: `alGuardar` suele llegar como una arrow inline, así que su
   * identidad cambia en cada render y no sirve como dependencia. Es el mismo
   * patrón que `AgregarDireccion`.
   */
  const ultimoCerrado = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!estado.token || estado.error) return
    if (ultimoCerrado.current === estado.token) return

    ultimoCerrado.current = estado.token
    alGuardar()
  })

  /*
   * Cómo está nombrado HOY, que no siempre es `cliente.tipo`. Es también lo que
   * la acción necesita para saber qué le falta al nombre antes de gastar un
   * viaje a `api/`, así que viaja con el formulario.
   */
  const forma = cliente.nombreLibre ? 'comercial' : 'residencial'

  return (
    <form action={accion} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="tipo" value={forma} />

      <div className="sm:col-span-2">
        <FormError id={idError}>{estado.error}</FormError>
      </div>

      <CamposDeNombre tipo={forma} inicial={cliente} />

      <p className="text-[13px] text-tenue sm:col-span-2">
        Lo que borre acá se borra. El nombre se guarda entero, así que un segundo nombre o un
        apodo que quede vacío deja de estar.
      </p>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start sm:col-span-2"
      >
        {enviando ? 'Guardando…' : 'Guardar el nombre'}
      </button>
    </form>
  )
}
