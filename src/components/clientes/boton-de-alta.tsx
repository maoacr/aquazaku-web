'use client'

import { UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AltaEnPasos } from '@/components/clientes/alta-en-pasos'
import type { Departamento, Municipio } from '@/lib/api-types'

/**
 * El botón que abre el alta — M16.
 *
 * ── Por qué el formulario ya no vive abierto en la pantalla ─────────────────
 *
 * Estaba desplegado al fondo de Clientes, siempre. Nueve campos ocupando media
 * pantalla para una acción que se hace unas pocas veces al día, debajo de la
 * lista que sí se mira todo el tiempo.
 *
 * Detrás de un botón, la pantalla vuelve a ser lo que es —buscar a alguien— y
 * el alta aparece cuando se la pide. Es además el mismo gesto que en el
 * mostrador: ahí también es un modal.
 */
export function BotonDeAlta({
  departamentos,
  municipios,
}: {
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const [abierto, setAbierto] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        <UserPlus aria-hidden className="size-4" />
        Registrar un cliente
      </button>

      {/*
        Se monta recién al abrirlo, y NO es una optimización: el alta guarda su
        estado —el paso, el documento, el nombre— en `useState`. Montada desde
        el principio, cerrarla y volver a abrirla mostraría lo de la vez
        anterior. Montar de nuevo es más barato que acordarse de limpiar.
      */}
      {abierto ? (
        <AltaEnPasos
          abierto
          cerrar={() => setAbierto(false)}
          departamentos={departamentos}
          municipios={municipios}
          alCrear={() => {
            // Para que la lista de recientes muestre al que se acaba de crear.
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
