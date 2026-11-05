import { EyeOff, Undo2 } from 'lucide-react'
import Link from 'next/link'
import {
  type CanalDeSeguimiento,
  ETIQUETA_DE_CANAL,
  rutaDeCanal,
} from '@/components/clientes/pestanas-de-seguimientos'

/**
 * El acceso a las filas que alguien sacó de la lista — RN-CLI-18.
 *
 * ── Por qué este botón es parte de la función, y no un extra ────────────────
 *
 * Sin él, la X es una trampa. Una fila oculta por error desaparece hasta la
 * próxima venta de ese cliente —pueden ser semanas— y en el medio nadie lo va a
 * llamar. Esta lista es el padrón de a quién atender: esconder algo acá sin
 * forma de verlo es perder un cliente en silencio.
 *
 * ── Y por qué aparece SOLO si hay algo ──────────────────────────────────────
 *
 * Un botón permanente que la mayoría de los días no tiene nada que mostrar es
 * ruido en una cabecera que se lee de reojo entre cliente y cliente. El conteo
 * viaja en la misma petición de la lista, así que saber si corresponde no
 * cuesta nada.
 *
 * No hay `'use client'`: es un enlace.
 */
export function AvisoDeOcultas({
  cuantas,
  canal,
  basePath,
  modoOcultas,
}: {
  /** Cuántas hay ocultas en ESTE canal. Cero significa que no se pinta nada. */
  cuantas: number
  canal: CanalDeSeguimiento
  basePath: string
  modoOcultas: boolean
}) {
  if (modoOcultas) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-elevada px-3 py-2">
        <p className="text-[13px] text-secundario">
          <EyeOff aria-hidden className="mr-1.5 inline size-3.5 align-[-2px] text-icono" />
          Está viendo las filas que se sacaron a mano de{' '}
          <span className="text-principal">{ETIQUETA_DE_CANAL[canal]}</span>. Vuelven solas si el
          cliente registra una venta.
        </p>

        <Link
          href={rutaDeCanal(basePath, canal)}
          className="aq-boton aq-boton-secundario aq-boton-compacto shrink-0"
        >
          <Undo2 aria-hidden className="size-4" />
          Volver a la lista
        </Link>
      </div>
    )
  }

  if (cuantas === 0) return null

  return (
    <Link
      href={rutaDeCanal(basePath, canal, undefined, true)}
      className="aq-micro inline-flex w-fit items-center gap-1.5 text-tenue hover:text-secundario"
    >
      <EyeOff aria-hidden className="size-3.5" />
      {/*
        El número va en el texto, y no es decorativo: «mostrar clientes
        ocultos» no dice si vale la pena el clic. «(3)» sí.
      */}
      Mostrar clientes ocultos ({cuantas})
    </Link>
  )
}
