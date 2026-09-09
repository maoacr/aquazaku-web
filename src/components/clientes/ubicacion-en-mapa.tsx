'use client'

import { MapPin } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { Direccion, Municipio } from '@/lib/api-types'

/**
 * Marcar la ubicación en el mapa — M14, opcional.
 *
 * ── El toggle no es cosmético ───────────────────────────────────────────────
 *
 * Leaflet pesa unos 45 KB comprimidos. Detrás de un interruptor, quien registra
 * veinte direcciones sin abrirlo **nunca descarga la librería**: `next/dynamic`
 * la trae recién cuando alguien la enciende.
 *
 * Y `ssr: false` es obligatorio, no una optimización: Leaflet toca `window` al
 * importarse, y en el servidor eso revienta.
 *
 * ── Por qué es opcional del todo ────────────────────────────────────────────
 *
 * Es la misma decisión que el resto de la dirección: nada es obligatorio.
 * Aquazaku reparte en pueblos donde una dirección puede ser «Vereda La Peña,
 * casa de tabla azul», y quien la carga puede no saber dónde queda en un mapa.
 *
 * El pin gana valor cuando llegue M8 —una ruta se ordena por coordenadas, no
 * por nomenclatura— pero exigirlo hoy bloquearía el registro de un cliente
 * real por un dato que todavía no usa nadie.
 */

const Mapa = dynamic(() => import('./mapa-de-ubicacion'), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 w-full place-items-center rounded-lg border border-sutil text-[14px] text-tenue">
      Cargando el mapa…
    </div>
  ),
})

export function UbicacionEnMapa({
  inicial,
  municipios,
  municipioElegido,
}: {
  inicial?: Direccion
  municipios: Municipio[]
  /** Para abrir el mapa donde la persona ya dijo que queda. */
  municipioElegido?: string
}) {
  const guardado =
    inicial?.latitud && inicial?.longitud
      ? { lat: Number(inicial.latitud), lng: Number(inicial.longitud) }
      : undefined

  // Si ya tenía pin, el mapa arranca abierto: esconder un dato cargado lo
  // vuelve invisible, y alguien lo va a dar por perdido.
  const [abierto, setAbierto] = useState(Boolean(guardado))
  const [posicion, setPosicion] = useState(guardado)

  /*
   * El centro sale del municipio que la persona escribió, con las coordenadas
   * del DANE que ya viajan en el catálogo. Abrir el mapa en el pueblo correcto
   * ahorra el paso de buscarlo, que en un celular es el más molesto.
   */
  const centro = municipioElegido
    ? municipios.find((m) => m.nombre.toLowerCase() === municipioElegido.trim().toLowerCase())
    : undefined

  return (
    <div className="grid gap-3">
      {/* Los valores viajan en el formulario, los pinte o no el mapa. */}
      <input type="hidden" name="latitud" value={posicion?.lat ?? ''} />
      <input type="hidden" name="longitud" value={posicion?.lng ?? ''} />

      {/*
        `.aq-ficha` y no una casilla suelta: la regla de los 44 px exime a los
        checkbox porque agrandar la caja los deforma, y esa exención deja el
        control más chico de la app en una pantalla que se usa desde un celular
        parado al lado de una llenadora. El objetivo táctil es la ficha entera;
        la casilla real queda en `sr-only` para el lector de pantalla.
      */}
      <label className="aq-ficha">
        <input
          type="checkbox"
          checked={abierto}
          onChange={(e) => setAbierto(e.target.checked)}
          className="sr-only"
        />
        <span className="aq-ficha-caja" aria-hidden />
        <MapPin aria-hidden className="size-4 shrink-0 text-icono" />
        Marcar la ubicación exacta en el mapa
      </label>

      {abierto ? (
        <>
          <Mapa
            centro={centro ? { lat: centro.lat, lng: centro.lng } : undefined}
            inicial={guardado}
            alMover={setPosicion}
          />

          <p className="text-[13px] text-tenue">
            {posicion
              ? `Ubicación marcada: ${posicion.lat.toFixed(5)}, ${posicion.lng.toFixed(5)}`
              : 'Toque el mapa o arrastre el pin hasta la puerta.'}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-tenue">
          Opcional. Sirve para armar las rutas de reparto cuando dos direcciones se escriben
          parecido pero quedan lejos.
        </p>
      )}
    </div>
  )
}
