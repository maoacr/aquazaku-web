'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

/**
 * El pin de una dirección — M14.
 *
 * ── Se arrastra, no se geocodifica ──────────────────────────────────────────
 *
 * Ningún servicio encuentra `CL 5 # 3-24, Campo de la Cruz` con precisión: los
 * datos de OSM y de Google en municipios pequeños de Colombia no llegan a ese
 * nivel.
 *
 * Así que el flujo va al revés: el mapa se centra en el municipio y **la
 * persona pone el pin**. Las coordenadas salen de alguien que sabe dónde está
 * la casa, no de un algoritmo que adivina. Una ruta calculada sobre una
 * posición inventada es peor que ninguna.
 *
 * ── Este archivo se carga aparte ────────────────────────────────────────────
 *
 * Leaflet pesa unos 45 KB comprimidos, y la mayoría de las direcciones se van a
 * cargar sin tocar el mapa. El componente padre lo trae con `next/dynamic`, así
 * que quien no abre el mapa **nunca descarga la librería**.
 *
 * Y va con `ssr: false` obligatorio: Leaflet toca `window` al importarse.
 */

/** Campo de la Cruz. Es donde está la planta, y el destino más probable. */
const POR_DEFECTO: [number, number] = [10.378291, -74.880847]

/**
 * Un ícono propio en vez del de Leaflet.
 *
 * El marcador que trae por defecto apunta a un PNG por ruta relativa, y esa
 * ruta se rompe con cualquier bundler — aparece un cuadrado vacío que nadie
 * asocia con «falta un archivo». Un `DivIcon` con SVG inline no puede fallar
 * así, y además usa el color del sistema.
 */
const PIN = L.divIcon({
  className: '',
  html: `<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
    <path fill="var(--aq-texto-alerta, #c0392b)" stroke="white" stroke-width="1.5"
      d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/>
    <circle cx="12" cy="9" r="2.5" fill="white"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
})

export default function MapaDeUbicacion({
  centro,
  inicial,
  alMover,
}: {
  /** Dónde abrir el mapa: el municipio elegido, si hay uno. */
  centro?: { lat: number; lng: number }
  /** El pin ya guardado, si esta dirección ya tenía uno. */
  inicial?: { lat: number; lng: number }
  alMover: (posicion: { lat: number; lng: number }) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const marcador = useRef<L.Marker | null>(null)

  /*
   * Las props del montaje viven en una referencia, y no en las dependencias del
   * efecto.
   *
   * No es para callar al lint: ponerlas como dependencias **recrearía el mapa
   * entero en cada render**, y con él perdería el pin que la persona acaba de
   * arrastrar. El mapa se construye una vez; lo que cambia después se maneja
   * aparte.
   *
   * La referencia se actualiza en cada render, así que `alMover` siempre apunta
   * al callback actual aunque el efecto se haya corrido una sola vez.
   */
  const props = useRef({ centro, inicial, alMover })

  /*
   * Se sincroniza en un efecto y no durante el render: React 19 prohíbe
   * escribir una referencia mientras se renderiza, y con razón — un render
   * puede descartarse, y la escritura quedaría igual.
   *
   * Va declarado ANTES del efecto que construye el mapa: en el montaje los
   * efectos corren en orden de declaración, así que cuando el mapa lea
   * `props.current` ya está puesto.
   */
  useEffect(() => {
    props.current = { centro, inicial, alMover }
  })

  useEffect(() => {
    if (!contenedor.current || mapa.current) return

    const { centro: c, inicial: i } = props.current
    const arranque = i ?? c ?? { lat: POR_DEFECTO[0], lng: POR_DEFECTO[1] }

    /*
     * Zoom 16 con pin previo, 14 sin él: si ya hay una ubicación se muestra la
     * cuadra; si no, el pueblo entero, que es lo que hace falta para encontrar
     * el barrio antes de precisar la casa.
     */
    const m = L.map(contenedor.current).setView([arranque.lat, arranque.lng], i ? 16 : 14)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // La atribución no es cortesía: es la licencia de OpenStreetMap.
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)

    const marca = L.marker([arranque.lat, arranque.lng], { icon: PIN, draggable: true }).addTo(m)

    marca.on('dragend', () => {
      const p = marca.getLatLng()
      props.current.alMover({ lat: p.lat, lng: p.lng })
    })

    /*
     * Tocar el mapa también mueve el pin. Arrastrar un marcador de treinta
     * píxeles con el pulgar es incómodo, y esto se usa desde un celular parado
     * al lado de una llenadora.
     */
    m.on('click', (e: L.LeafletMouseEvent) => {
      marca.setLatLng(e.latlng)
      props.current.alMover({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    mapa.current = m
    marcador.current = marca

    /*
     * El mapa arranca con el tamaño que tenía el contenedor al montarse. Dentro
     * de un modal que acaba de abrirse eso puede ser cero, y quedan las tiles
     * grises. Un `invalidateSize` en el siguiente frame lo resuelve.
     */
    requestAnimationFrame(() => m.invalidateSize())

    return () => {
      m.remove()
      mapa.current = null
    }
  }, [])

  /*
   * Cambiar de municipio recentra el mapa, pero NO mueve el pin: quien ya lo
   * puso eligió un lugar, y corregir el municipio no es corregir la casa.
   */
  useEffect(() => {
    if (mapa.current && centro && !marcador.current?.getLatLng()) {
      mapa.current.setView([centro.lat, centro.lng], 14)
    }
  }, [centro])

  return (
    <div
      ref={contenedor}
      role="application"
      aria-label="Mapa para marcar la ubicación. Toque o arrastre el pin."
      className="h-72 w-full rounded-lg border border-sutil"
    />
  )
}
