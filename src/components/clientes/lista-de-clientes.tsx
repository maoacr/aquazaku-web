'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { buscarClientesAnchoAction } from '@/app/(app)/modulos/clientes/actions'
import { TarjetasDeClientes } from '@/components/clientes/tarjetas-de-clientes'
import type { Cliente } from '@/lib/api-types'

/**
 * Buscar y listar clientes — M16.
 *
 * ── Los dos defectos que esto vino a arreglar ───────────────────────────────
 *
 * **Las tildes.** El filtro vivía acá en el navegador y hacía `toLowerCase()`
 * sin tocar los acentos. Medido sobre datos reales: «gomez» NO encontraba a
 * «Rosa Elena Padilla Gómez», y «panaderia» NO encontraba a «Panadería del
 * Centro». En Colombia eso es la mitad de los apellidos, y nadie los teclea con
 * tilde. El buscador parecía roto porque lo estaba.
 *
 * **La escala.** Filtrar acá obligaba a traer TODOS los clientes en cada carga
 * de la pantalla. Con cinco mil, son cinco mil filas viajando para mostrar
 * veinte. El propio código lo anticipaba: «cuando la lista crezca, el filtro se
 * muda a api/».
 *
 * ── Por qué la pantalla no arranca vacía ────────────────────────────────────
 *
 * Los últimos registrados llegan del servidor y se muestran sin que nadie
 * busque. Una pantalla en blanco se siente rota, y además esconde el caso más
 * común después de un alta: volver a mirarlo por un dedazo.
 */

/** Lo mismo que exige `api`: con uno o dos caracteres la respuesta es ruido. */
const MINIMO = 3

/**
 * El tiempo que se espera antes de preguntar.
 *
 * Sin esto, «padilla» son siete consultas a la base. Con 250 ms, quien escribe
 * a velocidad normal dispara una sola — y quien escribe despacio ve resultados
 * mientras piensa, que es de lo que se trata.
 */
const ESPERA_MS = 250

export function ListaDeClientes({ recientes }: { recientes: Cliente[] }) {
  const idBusqueda = useId()
  const [consulta, setConsulta] = useState('')

  /*
   * ── La respuesta se guarda CON el término al que pertenece ────────────────
   *
   * No solo los clientes: también qué se buscó para obtenerlos. Eso hace dos
   * cosas de una.
   *
   * Primero, no hace falta limpiar nada al borrar el buscador: los visibles se
   * DERIVAN comparando, y con la consulta vacía el resultado son los recientes
   * sin que nadie escriba estado. Es lo que pedía `react-hooks/set-state-in-
   * effect`, y tenía razón.
   *
   * Segundo —y más importante— es la guarda de carrera. Dos consultas en vuelo
   * pueden volver al revés: si la de «pad» llega después de la de «padilla», el
   * término no coincide y se descarta. Sin esto, la lista mostraría resultados
   * de algo que ya nadie tiene escrito.
   *
   * Es el mismo mecanismo que `useDireccionesDe` en la entrega de bases.
   */
  const [respuesta, setRespuesta] = useState<{ termino: string; clientes: Cliente[] } | null>(null)
  const [buscando, empezarBusqueda] = useTransition()
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const termino = consulta.trim()
  const hayBusqueda = termino.length >= MINIMO

  useEffect(() => {
    const limpio = consulta.trim()

    clearTimeout(temporizador.current)
    if (limpio.length < MINIMO) return

    let vigente = true

    temporizador.current = setTimeout(() => {
      empezarBusqueda(async () => {
        const clientes = await buscarClientesAnchoAction(limpio)
        if (vigente) setRespuesta({ termino: limpio, clientes })
      })
    }, ESPERA_MS)

    return () => {
      vigente = false
      clearTimeout(temporizador.current)
    }
  }, [consulta])

  const visibles = hayBusqueda
    ? respuesta?.termino === termino
      ? respuesta.clientes
      : []
    : recientes

  return (
    <div className="grid gap-4">
      <div className="aq-tarjeta grid gap-2 p-5">
        <label htmlFor={idBusqueda} className="aq-etiqueta-campo">
          <span>Buscar</span>
        </label>

        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue"
          />
          <input
            id={idBusqueda}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            type="search"
            autoComplete="off"
            placeholder="Nombre, apellido, apodo o documento"
            className="aq-campo aq-campo-con-icono"
          />
          {consulta.length > 0 ? (
            <button
              type="button"
              onClick={() => setConsulta('')}
              aria-label="Borrar la búsqueda"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-tenue hover:text-principal"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>

        {/*
          El estado se DICE. Sin esto, escribir dos letras y no ver cambios se
          lee como un buscador roto — que es exactamente lo que pasaba antes,
          por otro motivo.
        */}
        <p aria-live="polite" className="text-[13px] text-tenue">
          {consulta.trim().length > 0 && !hayBusqueda
            ? `Escriba al menos ${MINIMO} letras.`
            : buscando
              ? 'Buscando…'
              : hayBusqueda
                ? textoDeResultados(visibles.length)
                : 'Los últimos que se registraron. Escriba para buscar entre todos.'}
        </p>
      </div>

      <section className="grid gap-3">
        <TarjetasDeClientes clientes={visibles} hayFiltro={hayBusqueda} />
      </section>
    </div>
  )
}

/**
 * Concuerda en singular y plural sin el «(s)» que nadie dice hablando, y avisa
 * cuando el resultado está topeado: con muchas coincidencias la respuesta útil
 * no es una lista larga, es «afiná la búsqueda».
 */
function textoDeResultados(cuantos: number): string {
  if (cuantos === 0) return 'No hay ningún cliente que coincida.'
  if (cuantos === 1) return '1 cliente.'

  return `${cuantos} clientes. Si el que busca no está, escriba un poco más.`
}
