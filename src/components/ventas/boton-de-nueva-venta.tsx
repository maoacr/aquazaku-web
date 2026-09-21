'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import type { Producto, ResumenDeStock } from '@/lib/api-types'
import { Mostrador } from './mostrador'

/**
 * El botón que abre el alta de venta — M6.
 *
 * ── Por qué el formulario ya no vive abierto en la pantalla ─────────────────
 *
 * Estaba siempre desplegado en Ventas: cliente, productos, totales, base,
 * botellones, medio de pago, código y factura ocupando media pantalla para
 * una acción que se hace a destajo desde un celular al lado de la llenadora.
 * La lista de «Últimas ventas» — lo que se mira el resto del tiempo — vivía
 * debajo de un formulario que filtraba todo lo demás.
 *
 * Detrás de un botón, la pantalla vuelve a ser lo que es — ver lo que salió
 * y corregirlo si hace falta — y el alta aparece cuando se la pide. Es
 * además el mismo gesto que en Clientes: ahí también es un modal, con el
 * mismo `<Modal>` que ya se reusa para corregir y anular ventas.
 *
 * ── El MISMO formulario, no una copia ───────────────────────────────────────
 *
 * Es `<Mostrador enModal>` con los mismos productos, el mismo stock y la misma
 * Server Action. Una pantalla de alta paralela terminaría separándose del
 * mostrador real en el primer cambio — el piso de la fecha, el filtro de
 * dígitos en el precio, el cap de botellones — y la corrección de hoy, que
 * también usa `<Mostrador>`, quedaría viviendo en una versión vieja del alta.
 */
export function BotonDeNuevaVenta({
  productos,
  stock,
}: {
  productos: Producto[]
  stock: ResumenDeStock[]
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {/*
        Acción primaria de la pantalla, así que va arriba con el encabezado y
        no al fondo. Si queda debajo de la lista hay que recorrer veinte filas
        para encontrarla — y con quinientas, no se encuentra nunca.
      */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        <Plus aria-hidden className="size-4" />
        Registrar nueva venta
      </button>

      {/*
        El `<Modal>` solo monta el contenido cuando está abierto: cerrar y
        volver a abrir muestra un formulario limpio, no lo que alguien había
        empezado y descartado. Ver el comentario del propio `<Modal>`.
      */}
      <Modal
        abierto={abierto}
        cerrar={() => setAbierto(false)}
        titulo="Registrar nueva venta"
      >
        <Mostrador
          productos={productos}
          stock={stock}
          enModal
          alRegistrar={() => setAbierto(false)}
        />
      </Modal>
    </>
  )
}