'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AgregarDireccion } from '@/components/clientes/acciones-de-cliente'
import { Modal } from '@/components/ui/modal'
import type { Departamento, Municipio } from '@/lib/api-types'

/**
 * Agregar una dirección, detrás de un botón — M16.
 *
 * ── Por qué no vive abierto en la ficha ─────────────────────────────────────
 *
 * El formulario son doce campos —vía, placa, municipio, departamento, cómo
 * llegar, el mapa—, y estaba desplegado permanentemente debajo de la lista de
 * direcciones. La ficha del cliente se abre para MIRAR: cuánto debe, a qué
 * número llamarlo, a cuál de sus locales ir a buscar la 0913. Un formulario
 * largo entre esos datos empuja todo lo demás fuera de la pantalla, y en un
 * celular al lado de una llenadora eso es scroll que nadie hace.
 *
 * Cargar una dirección es lo excepcional; verla, lo de todos los días.
 *
 * ── Y se monta recién al abrirlo ────────────────────────────────────────────
 *
 * `Modal` no renderiza su contenido mientras está cerrado. Los doce campos y
 * los 1122 municipios del desplegable no se arman hasta que alguien los pide.
 */
export function BotonDeDireccion({
  clienteId,
  departamentos,
  municipios,
}: {
  clienteId: string
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="aq-boton aq-boton-secundario justify-self-start"
      >
        <Plus aria-hidden className="size-4" />
        Agregar dirección
      </button>

      <Modal abierto={abierto} cerrar={() => setAbierto(false)} titulo="Agregar una dirección">
        <AgregarDireccion
          clienteId={clienteId}
          departamentos={departamentos}
          municipios={municipios}
          /*
           * Se cierra solo cuando la dirección QUEDÓ guardada. Cerrarlo al
           * enviar dejaría la duda de si entró, y la lista de atrás se
           * actualiza recién con la revalidación.
           */
          alAgregar={() => setAbierto(false)}
        />
      </Modal>
    </>
  )
}
