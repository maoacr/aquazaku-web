'use client'

import { useState } from 'react'
import type { Departamento, Direccion, Municipio } from '@/lib/api-types'
import { UbicacionEnMapa } from './ubicacion-en-mapa'

/**
 * Los campos de una dirección — M14.
 *
 * ── Uno solo para el alta y la edición ──────────────────────────────────────
 *
 * Duplicados, en un mes tienen campos distintos: se agrega uno al alta, nadie
 * se acuerda de la edición, y editar una dirección le borra el dato nuevo —
 * porque el formulario manda todo y lo que no está llega ausente.
 *
 * ── Ningún campo de ubicación es obligatorio ────────────────────────────────
 *
 * Aquazaku reparte en pueblos donde hay direcciones que son «Vereda La Peña,
 * casa de tabla azul». Exigir la nomenclatura haría que el operador invente
 * `CL 1 # 1-1` para poder guardar.
 *
 * ── Por qué la nomenclatura va en UNA línea ─────────────────────────────────
 *
 * Son siete campos. Apilados con su etiqueta cada uno, el formulario se ve como
 * un trámite y nadie lo completa. En una línea —con el `#` y el `-` entre
 * medio— se lee como la dirección que es.
 */

/**
 * Los tipos de vía que se usan en Colombia.
 *
 * Va como `datalist` y no como `select`: la lista cubre lo común, y quien tenga
 * una vía que no está —«Anillo Vial», «Km 3»— la escribe igual. Un desplegable
 * cerrado bloquearía una dirección REAL.
 */
const TIPOS_DE_VIA = ['CL', 'KR', 'TV', 'DG', 'AV', 'AC', 'AK', 'CIRCUNVALAR', 'VDA', 'KM']

export function CamposDeDireccion({
  inicial,
  departamentos,
  municipios,
}: {
  inicial?: Direccion
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const v = (campo: keyof Direccion) => (inicial?.[campo] as string | null) ?? undefined

  /*
   * El municipio vive acá y no dentro de `Geografia` porque el mapa lo
   * necesita: se abre centrado en el pueblo que la persona escribió, con las
   * coordenadas del DANE que ya viajan en el catálogo.
   */
  const [municipio, setMunicipio] = useState(inicial?.municipio ?? '')

  return (
    <>
      <label className="aq-etiqueta-campo">
        <span>Cómo la llaman</span>
        <input
          name="etiqueta"
          required
          defaultValue={v('etiqueta')}
          placeholder="La casa, el negocio, la sucursal norte"
          className="aq-campo"
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="aq-etiqueta-campo mb-1">
          <span>
            Dirección <span className="font-normal normal-case">(si la tiene)</span>
          </span>
        </legend>

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="viaTipo"
            list="tipos-de-via"
            defaultValue={v('viaTipo')}
            placeholder="CL"
            aria-label="Tipo de vía"
            className="aq-campo aq-campo-via uppercase"
          />
          <datalist id="tipos-de-via">
            {TIPOS_DE_VIA.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <input
            name="viaNumero"
            defaultValue={v('viaNumero')}
            placeholder="45"
            aria-label="Número de la vía"
            className="aq-campo aq-campo-numero"
          />
          <input
            name="viaLetra"
            defaultValue={v('viaLetra')}
            placeholder="A"
            aria-label="Letra de la vía"
            className="aq-campo aq-campo-letra uppercase"
          />

          <span aria-hidden className="px-1 text-tenue">
            #
          </span>

          <input
            name="placaNumero"
            defaultValue={v('placaNumero')}
            placeholder="12"
            aria-label="Número de la placa"
            className="aq-campo aq-campo-numero"
          />
          <input
            name="placaLetra"
            defaultValue={v('placaLetra')}
            placeholder="B"
            aria-label="Letra de la placa"
            className="aq-campo aq-campo-letra uppercase"
          />

          <span aria-hidden className="px-1 text-tenue">
            –
          </span>

          <input
            name="placaSegundo"
            defaultValue={v('placaSegundo')}
            placeholder="34"
            aria-label="Segundo número"
            className="aq-campo aq-campo-numero"
          />
          <input
            name="placaLetraFinal"
            defaultValue={v('placaLetraFinal')}
            placeholder="C"
            aria-label="Letra final"
            className="aq-campo aq-campo-letra uppercase"
          />
        </div>

        <input
          name="complemento"
          defaultValue={v('complemento')}
          placeholder="Apto 302, torre B, local 4 (opcional)"
          aria-label="Complemento"
          className="aq-campo"
        />
      </fieldset>

      <Geografia
        inicial={inicial}
        departamentos={departamentos}
        municipios={municipios}
        alElegirMunicipio={setMunicipio}
      />

      {/*
        La salida para lo que no se descompone. No es un campo de respaldo: para
        media Colombia rural ES la dirección.
      */}
      <label className="aq-etiqueta-campo">
        <span>
          Si no se puede escribir así{' '}
          <span className="font-normal normal-case">(escríbala como es)</span>
        </span>
        <input
          name="direccion"
          defaultValue={v('direccion')}
          placeholder="Vereda La Peña, casa de tabla azul"
          className="aq-campo"
        />
      </label>

      <label className="aq-etiqueta-campo">
        <span>
          Cómo llegar <span className="font-normal normal-case">(opcional)</span>
        </span>
        <input
          name="indicaciones"
          defaultValue={v('indicaciones')}
          placeholder="Al lado de la panadería, portón verde"
          className="aq-campo"
        />
      </label>

      <UbicacionEnMapa
        inicial={inicial}
        municipios={municipios}
        municipioElegido={municipio}
      />
    </>
  )
}

/**
 * Municipio y departamento, con el catálogo del DANE — M14.
 *
 * ── Sugiere, no obliga ──────────────────────────────────────────────────────
 *
 * Es un `datalist`, no un `select`. La lista estandariza la ortografía de lo
 * que sí está y deja escribir lo que no: **el DANE lista municipios, no
 * veredas**, y Aquazaku reparte en algunas. Un desplegable cerrado bloquearía
 * una dirección real.
 *
 * ── El catálogo llega por props, no se pide desde el navegador ──────────────
 *
 * La primera versión lo traía con `fetch()` desde el cliente, y la regla del
 * BFF la frenó. Tenía razón, y además el camino corto era mejor: son 10 KB
 * comprimidos, así que el Server Component los pasa y desaparecen un route
 * handler, dos efectos, un estado de carga y una rama de error.
 *
 * Los municipios se filtran acá contra el departamento escrito. Con 1122 en
 * memoria eso es instantáneo, y no hay viaje que esperar mientras se tipea.
 */
function Geografia({
  inicial,
  departamentos,
  municipios,
  alElegirMunicipio,
}: {
  inicial?: Direccion
  departamentos: Departamento[]
  municipios: Municipio[]
  /** Sube al padre para que el mapa se abra en el pueblo correcto. */
  alElegirMunicipio: (nombre: string) => void
}) {
  const [departamento, setDepartamento] = useState(inicial?.departamento ?? '')

  const codigo = departamentos.find(
    (d) => d.nombre.toLowerCase() === departamento.trim().toLowerCase(),
  )?.codigo

  /*
   * Sin departamento elegido no se sugiere nada. Ofrecer los 1122 empeora la
   * sugerencia en vez de mejorarla: quien busca «Suan» encuentra veinte
   * homónimos de otros departamentos.
   */
  const sugeridos = codigo ? municipios.filter((m) => m.departamento === codigo) : []

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="aq-etiqueta-campo">
        <span>Departamento</span>
        <input
          name="departamento"
          list="departamentos"
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          placeholder="Atlántico"
          className="aq-campo"
        />
        <datalist id="departamentos">
          {departamentos.map((d) => (
            <option key={d.codigo} value={d.nombre} />
          ))}
        </datalist>
      </label>

      <label className="aq-etiqueta-campo">
        <span>Municipio, pueblo o vereda</span>
        <input
          name="municipio"
          list="municipios"
          defaultValue={inicial?.municipio ?? undefined}
          onChange={(e) => alElegirMunicipio(e.target.value)}
          placeholder="Campo de la Cruz"
          className="aq-campo"
        />
        <datalist id="municipios">
          {sugeridos.map((m) => (
            <option key={m.codigo} value={m.nombre} />
          ))}
        </datalist>
      </label>
    </div>
  )
}
