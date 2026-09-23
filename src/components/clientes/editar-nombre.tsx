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
 * ── La forma sale del TIPO, y el dato se acomoda ───────────────────────────
 *
 * Antes salía del dato: `nombreLibre` presente ⇒ un solo campo. Tenía sentido
 * cuando eso casi siempre era un negocio.
 *
 * Desde RN-CLI-20 es el caso MÁS COMÚN de una persona: quien se registra con
 * «Rosa» y nada más se guarda en `nombreLibre`, porque la base no acepta un
 * nombre partido a medias. Con la regla vieja, editar a Rosa abría el
 * formulario de un negocio — y para partir su nombre había que borrarlo y
 * escribirlo de nuevo.
 *
 * Ahora un residencial ve SIEMPRE los campos partidos, y lo que estaba en
 * `nombreLibre` viene puesto en el primer nombre: es lo más probable que sea, y
 * completar el apellido es escribir una palabra en vez de rehacer el nombre.
 *
 * No se pierde nada al guardar: si dejan solo el primer nombre, vuelve a viajar
 * como `nombreLibre` (`nombreParaGuardar`). El formulario dejó de exigir la
 * forma completa.
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
   * La forma sale del TIPO del cliente. Un negocio se nombra con una sola
   * cadena; una persona, con partes.
   */
  const forma = cliente.tipo === 'comercial' ? 'comercial' : 'residencial'

  /*
   * Y a la persona guardada sin partir se le PRE-CARGA lo que tenía en el
   * primer nombre. Sin esto, abrir a «Rosa» mostraría cuatro campos vacíos y
   * guardar le borraría el único nombre que tiene — `api/` reemplaza el nombre
   * entero.
   *
   * El apodo se respeta si ya existe; si el apodo era TODO lo que había, el
   * primer nombre queda con esa misma palabra, que es como la conocen.
   */
  const inicial =
    forma === 'residencial' && cliente.nombreLibre
      ? { ...cliente, nombreLibre: '', primerNombre: cliente.nombreLibre }
      : cliente

  return (
    <form action={accion} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="tipo" value={forma} />

      <div className="sm:col-span-2">
        <FormError id={idError}>{estado.error}</FormError>
      </div>

      <CamposDeNombre tipo={forma} inicial={inicial} />

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
