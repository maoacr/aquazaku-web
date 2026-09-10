'use client'

import { PackagePlus } from 'lucide-react'
import { useEffect, useId, useState, useTransition } from 'react'
import { direccionesDeClienteAction } from '@/app/(app)/modulos/clientes/actions'
import type { Cliente, Direccion } from '@/lib/api-types'

/**
 * Llevarse una base con la venta — RN-BAS-03.
 *
 * ── Por qué esto vive en el mostrador y no solo en Retornables ──────────────
 *
 * Entregar la base era un segundo acto en otra pantalla, y el segundo acto es
 * el que se olvida. Con la base ya en el auto del cliente, nadie vuelve a
 * Retornables a registrarla — y queda un activo de la planta afuera sin ninguna
 * fila que lo reclame. Es exactamente lo que pasó con los botellones antes de
 * RN-ENV-09.
 *
 * ── Va a una DIRECCIÓN, no a un cliente ─────────────────────────────────────
 *
 * RN-BAS-03, y no es un tecnicismo: un comercial con tres locales tiene una
 * base en cada uno. Si el préstamo apuntara al cliente, no se sabría a cuál de
 * los tres ir a buscarla — y una base que no se puede reclamar es una base
 * perdida con papeles.
 *
 * Por eso las direcciones se piden **del cliente ya elegido**, y recién ahí.
 * Antes se traían las de todos los clientes por adelantado: mil peticiones para
 * llenar un desplegable que nadie puede recorrer.
 */
/**
 * Las direcciones de un cliente, pedidas cuando ya se sabe de quién.
 *
 * Lo usan los dos lugares donde se presta una base: el mostrador y Retornables.
 * Uno solo, porque el mecanismo es el mismo y dos copias se separan.
 */
export function useDireccionesDe(cliente: Cliente | null) {
  /*
   * Se guarda DE QUIÉN son las direcciones, no solo las direcciones.
   *
   * Eso hace dos cosas de una. Primero, no hace falta limpiarlas al cambiar de
   * cliente: se derivan comparando el id, y sin cliente el resultado es la
   * lista vacía sin que nadie escriba estado. Segundo —y más importante— es la
   * guarda de carrera: si la respuesta de un cliente llega después de haber
   * elegido a otro, el id no coincide y se descarta.
   *
   * Mostrar las direcciones del cliente anterior es la peor equivocación
   * posible acá: la base terminaría prestada en la casa de otra persona.
   */
  const [respuesta, setRespuesta] = useState<{ clienteId: string; direcciones: Direccion[] } | null>(
    null,
  )
  const [cargando, empezarCarga] = useTransition()

  useEffect(() => {
    if (!cliente) return

    /*
     * La respuesta vieja se descarta AL LLEGAR, no después.
     *
     * La primera versión guardaba todas las respuestas y filtraba por id al
     * renderizar. No alcanza: la tardía pisaba a la buena, y entonces el filtro
     * descartaba las dos — el desplegable quedaba vacío con un cliente elegido.
     * Lo encontró el test, y era un defecto real.
     */
    let vigente = true

    empezarCarga(async () => {
      const direcciones = await direccionesDeClienteAction(cliente.id)
      if (vigente) setRespuesta({ clienteId: cliente.id, direcciones })
    })

    return () => {
      vigente = false
    }
  }, [cliente])

  const direcciones = cliente && respuesta?.clienteId === cliente.id ? respuesta.direcciones : []

  return { direcciones, cargando }
}

/** El desplegable de «a qué dirección», con el nombre de campo que le pidan. */
export function SelectorDeDireccion({
  cliente,
  name,
}: {
  cliente: Cliente | null
  name: string
}) {
  const { direcciones, cargando } = useDireccionesDe(cliente)

  if (!cliente) return null

  if (!cargando && direcciones.length === 0) {
    return (
      <p className="text-[13px] text-alerta-texto">
        {cliente.nombre} no tiene ninguna dirección cargada. Una base se presta a una
        dirección, que es a donde hay que ir a buscarla: cárguele una desde su ficha.
      </p>
    )
  }

  return (
    <label className="aq-etiqueta-campo">
      <span>A qué dirección</span>
      {/*
        Sin `value`, sin `defaultValue` y sin estado, y eso es deliberado.
        
        Con una sola dirección viene elegida sola: un `<select>` sin opción
        vacía selecciona la primera, y eso es lo que viaja en el `FormData`.
        Preguntar entre una sola opción es una pregunta que no existe.
        
        Se probaron tres formas de forzarlo —controlado con valor derivado,
        `defaultValue`, y un `key` que remonta— y la ablación las tumbó a las
        tres: ninguna cambiaba el resultado. Era mecanismo para un problema que
        el navegador ya resuelve.
      */}
      <select name={name} className="aq-campo">
        {direcciones.length === 1 ? null : <option value="">Elija una</option>}
        {direcciones.map((d) => (
          <option key={d.id} value={d.id}>
            {/*
              `legible` la arma `api`: la función que compone la nomenclatura
              vive allá y `web` no puede importarla. Si cada pantalla la armara,
              en tres meses habría tres formatos.
            */}
            {d.etiqueta} — {d.legible}
          </option>
        ))}
      </select>
    </label>
  )
}

export function EntregaDeBase({ cliente }: { cliente: Cliente | null }) {
  const idSticker = useId()
  const [abierto, setAbierto] = useState(false)
  const { direcciones, cargando } = useDireccionesDe(cliente)

  // Sin cliente no hay a quién prestarle: RN-BAS-03 no tiene dónde apuntar.
  if (!cliente) return null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        <PackagePlus aria-hidden className="size-4" />
        ¿Se lleva una base?
      </button>
    )
  }

  /*
   * Sin direcciones no se puede prestar, y hay que DECIRLO en vez de mostrar un
   * desplegable vacío. La salida está en la ficha del cliente, y el texto la
   * nombra: un aviso que no dice qué hacer es un aviso que frustra.
   */
  if (!cargando && direcciones.length === 0) {
    return (
      <div className="rounded-lg border border-sutil p-4">
        <p className="text-[13px] text-principal">
          {cliente.nombre} no tiene ninguna dirección cargada.
        </p>
        <p className="mt-1 text-[13px] text-tenue">
          Una base se presta a una dirección, que es a donde hay que ir a buscarla. Cárguele
          una desde su ficha y vuelva.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 rounded-lg border border-sutil p-4">
      <div>
        <p className="text-[13px] text-principal">Se lleva una base</p>
        <p className="mt-1 text-[13px] text-tenue">
          Queda prestada, no vendida: sigue siendo de la planta. El cliente tiene que estar
          verificado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Código de la base</span>
          {/*
            Se escribe el STICKER, no se elige de una lista.

            El número está pegado en la base que la persona tiene en la mano, y
            teclear cuatro dígitos es más rápido que buscar en un desplegable de
            cuarenta. Si el código no existe, `api/` lo dice con el número que
            se buscó — el error más probable es un dedazo.
          */}
          <input
            id={idSticker}
            name="baseSticker"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0042"
            className="aq-campo aq-cifra"
          />
        </label>

        <SelectorDeDireccion cliente={cliente} name="baseDireccionId" />
      </div>

      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        No se lleva ninguna
      </button>
    </div>
  )
}
