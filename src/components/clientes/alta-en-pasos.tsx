'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { crearClienteRapidoAction, geografiaAction } from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { CamposDeDireccion } from '@/components/clientes/campos-de-direccion'
import { CamposDeNombre, NOMBRE_VACIO, type Nombre } from '@/components/clientes/campos-de-nombre'
import { DocumentoPrimero, type EstadoDelDocumento } from '@/components/clientes/documento-primero'
import { Modal } from '@/components/ui/modal'
import type { Cliente, Departamento, Municipio } from '@/lib/api-types'

/**
 * El alta de cliente, en tres pasos — M16.
 *
 * ── Por qué un stepper y no el formulario largo ─────────────────────────────
 *
 * El alta pedía nueve campos en una columna, y la dirección quedaba fuera: había
 * que registrar al cliente y después buscarlo otra vez para cargársela. En el
 * mostrador eso pasa con alguien esperando enfrente.
 *
 * Tres pasos, y cada uno contesta UNA pregunta:
 *
 *   1. **Quién es** — el documento primero, para no escribir nada si ya existe
 *   2. **A qué número llamarlo**
 *   3. **Dónde queda**
 *
 * ── Uno solo, usado en dos lugares ──────────────────────────────────────────
 *
 * El mismo componente vive en Clientes —detrás de un botón— y en el mostrador,
 * dentro de la venta. Antes eran dos altas distintas y **solo una ofrecía
 * cargar la dirección**: quien registraba desde el mostrador quedaba con un
 * cliente sin domicilio, y una base se presta a una DIRECCIÓN (RN-BAS-03).
 *
 * ── Y UN solo envío al final ────────────────────────────────────────────────
 *
 * `POST /clientes` acepta cliente, teléfono y dirección en una transacción. Con
 * tres envíos, un fallo en el tercero dejaría un cliente a medio cargar y quien
 * atiende no sabría qué quedó guardado.
 */

const PASOS = [
  { n: 1, titulo: 'Quién es' },
  { n: 2, titulo: 'A qué número llamarlo' },
  { n: 3, titulo: 'Dónde queda' },
] as const

export function AltaEnPasos({
  abierto,
  cerrar,
  departamentos,
  municipios,
  documentoInicial = '',
  alCrear,
}: {
  abierto: boolean
  cerrar: () => void
  /**
   * El catálogo del DANE. **Opcional**: si no viene, se pide al llegar al paso
   * de la dirección.
   *
   * Este componente vive en cuatro pantallas —Clientes, el mostrador y las dos
   * de Retornables—. Exigirlo como prop obligaría a las cuatro a cargar 1122
   * municipios en cada visita por si alguien registra un cliente, y en el
   * mostrador eso es en cada venta.
   *
   * Clientes ya lo tiene a mano y lo pasa; el resto lo pide cuando hace falta,
   * que muchas veces es nunca.
   */
  departamentos?: Departamento[]
  municipios?: Municipio[]
  /** Lo que ya se había tecleado en el buscador de la venta. */
  documentoInicial?: string
  /** Para que quien lo abrió pueda elegirlo sin volver a buscarlo. */
  alCrear?: (cliente: Cliente) => void
}) {
  const idError = useId()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | undefined>(undefined)
  const [enviando, empezarEnvio] = useTransition()

  const [tipo, setTipo] = useState<'residencial' | 'comercial'>('residencial')
  const [tipoDocumento, setTipoDocumento] = useState<'CC' | 'NIT'>('CC')
  const [numeroDocumento, setNumeroDocumento] = useState(documentoInicial)
  const [estadoDelDocumento, setEstadoDelDocumento] = useState<EstadoDelDocumento>('vacio')
  const [nombre, setNombre] = useState<Nombre>(NOMBRE_VACIO)
  const [telefono, setTelefono] = useState('')
  const [etiquetaDelTelefono, setEtiquetaDelTelefono] = useState('')

  /*
   * La dirección se lee del DOM al enviar, no se refleja en estado.
   *
   * `CamposDeDireccion` son doce campos con `name` —vía, placa, municipio,
   * departamento, coordenadas—, pensados para viajar en un `FormData`. Copiarlos
   * a estado sería mantener trece `useState` sincronizados con el único fin de
   * volver a armarlos al final.
   *
   * El `ref` apunta al formulario que los contiene, y sigue montado mientras el
   * paso 3 está a la vista — que es cuando se envía.
   */
  const formulario = useRef<HTMLFormElement>(null)

  /*
   * El catálogo, pedido al llegar al paso 3 y no antes.
   *
   * Se guarda en estado en vez de derivarse porque es una respuesta del
   * servidor: lo que llega se queda hasta que el modal se desmonte, que es al
   * cerrarlo. No hay carrera posible — se pide una sola vez.
   */
  const [catalogo, setCatalogo] = useState<{
    departamentos: Departamento[]
    municipios: Municipio[]
  } | null>(departamentos && municipios ? { departamentos, municipios } : null)

  function irAlPaso(siguiente: 1 | 2 | 3) {
    setPaso(siguiente)

    if (siguiente === 3 && !catalogo) {
      empezarEnvio(async () => setCatalogo(await geografiaAction()))
    }
  }

  const hayNombre = Boolean(
    tipo === 'comercial' ? nombre.nombreLibre?.trim() : nombre.primerNombre?.trim() && nombre.apellidos?.trim(),
  )
  const documentoServible = numeroDocumento.replace(/\D/g, '').length >= 3
  const documentoLibre = estadoDelDocumento === 'libre' || estadoDelDocumento === 'cruce'

  /*
   * El paso 1 exige documento Y nombre. Sin documento no hay a quién reclamarle
   * nada (RN-CLI-13), y sin nombre el cliente es una cédula suelta.
   *
   * También frena si el documento está TOMADO: avanzar sería hacer escribir un
   * nombre para un cliente que ya existe.
   */
  const puedeAvanzar = paso === 1 ? documentoServible && documentoLibre && hayNombre : true

  const telefonoCorto = telefono.trim().length > 0 && telefono.trim().length < 7

  function registrar() {
    if (telefonoCorto) {
      setError('Un teléfono tiene al menos 7 dígitos. Bórrelo o complételo.')
      return
    }

    setError(undefined)

    /*
     * La dirección va solo si tiene ETIQUETA. Es el único campo que `api` exige
     * —«la casa», «el local»— y es lo que distingue «no cargó dirección» de
     * «cargó una a medias»: sin él, un municipio suelto viajaría como dirección
     * y `api` la rechazaría con un 422 al final de los tres pasos.
     */
    const campos = formulario.current ? new FormData(formulario.current) : null
    const etiqueta = String(campos?.get('etiqueta') ?? '').trim()

    const direccion = etiqueta
      ? Object.fromEntries(
          [...(campos?.entries() ?? [])]
            .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
            .map(([k, v]) => [k, String(v).trim()]),
        )
      : undefined

    empezarEnvio(async () => {
      const resultado = await crearClienteRapidoAction({
        ...nombre,
        tipo,
        tipoDocumento,
        numeroDocumento: numeroDocumento.replace(/\D/g, ''),
        ...(telefono.trim() && {
          telefono: {
            numero: telefono.trim(),
            ...(etiquetaDelTelefono.trim() && { etiqueta: etiquetaDelTelefono.trim() }),
          },
        }),
        ...(direccion && { direccion }),
      })

      if (resultado.error) {
        setError(resultado.error)
        return
      }

      if (resultado.cliente) {
        alCrear?.(resultado.cliente)
        cerrar()
      }
    })
  }

  return (
    <Modal abierto={abierto} cerrar={cerrar} titulo="Registrar cliente">
      <div className="grid gap-5">
        <Progreso paso={paso} />

        <FormError id={idError}>{error}</FormError>

        {/*
          Los tres pasos se MONTAN siempre y se esconden con `hidden`, en vez de
          renderizarse condicionalmente.

          Desmontar el paso 1 al avanzar borraría el nombre ya escrito, y volver
          atrás lo pediría de nuevo. Y el paso 3 tiene que estar montado al
          enviar: sus campos se leen del DOM con un `FormData`.
        */}
        <form
          ref={formulario}
          onSubmit={(e) => {
            e.preventDefault()
            if (paso === 3) registrar()
          }}
          className="grid gap-5"
        >
          <div hidden={paso !== 1} className="grid gap-5">
            <DocumentoPrimero
              tipoDocumento={tipoDocumento}
              onTipoDocumento={setTipoDocumento}
              numero={numeroDocumento}
              onNumero={setNumeroDocumento}
              onEstado={setEstadoDelDocumento}
            />

            <fieldset className="grid gap-2">
              <legend className="aq-micro text-tenue">Quién es</legend>
              <div className="flex flex-wrap gap-2">
                {(['residencial', 'comercial'] as const).map((opcion) => (
                  <label key={opcion} className="aq-ficha">
                    <input
                      type="radio"
                      name="_tipoDeCliente"
                      value={opcion}
                      checked={tipo === opcion}
                      onChange={() => {
                        setTipo(opcion)
                        setTipoDocumento(opcion === 'comercial' ? 'NIT' : 'CC')
                      }}
                      className="sr-only"
                    />
                    <span className="aq-ficha-caja" aria-hidden />
                    {opcion === 'residencial' ? 'Una persona' : 'Un negocio'}
                  </label>
                ))}
              </div>
            </fieldset>

            <CamposDeNombre tipo={tipo} valor={nombre} onCambio={setNombre} />
          </div>

          <div hidden={paso !== 2} className="grid gap-4 sm:grid-cols-2">
            <label className="aq-etiqueta-campo">
              <span>
                Teléfono <span className="font-normal normal-case">(opcional)</span>
              </span>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="300 123 4567"
                className="aq-campo aq-cifra"
              />
              <span className="mt-1 font-normal normal-case text-[13px] text-tenue">
                Sin número no hay a quién reclamarle un envase.
              </span>
            </label>

            <label className="aq-etiqueta-campo">
              <span>
                Cómo se llama ese número{' '}
                <span className="font-normal normal-case">(opcional)</span>
              </span>
              <input
                value={etiquetaDelTelefono}
                onChange={(e) => setEtiquetaDelTelefono(e.target.value)}
                autoComplete="off"
                placeholder="el celular del dueño"
                className="aq-campo"
              />
            </label>
          </div>

          <div hidden={paso !== 3} className="grid gap-4">
            <p className="text-[13px] text-tenue">
              Una base se presta a una dirección, que es a donde hay que ir a buscarla. Si
              todavía no la sabe, puede registrarlo igual.
            </p>
            {catalogo ? (
              <CamposDeDireccion
                departamentos={catalogo.departamentos}
                municipios={catalogo.municipios}
                opcional
              />
            ) : (
              <p className="text-[13px] text-tenue">Cargando municipios…</p>
            )}
          </div>

          <Botones
            paso={paso}
            puedeAvanzar={puedeAvanzar}
            enviando={enviando}
            hayTelefono={telefono.trim().length > 0}
            atras={() => irAlPaso(paso === 3 ? 2 : 1)}
            siguiente={() => irAlPaso(paso === 1 ? 2 : 3)}
            cerrar={cerrar}
          />
        </form>
      </div>
    </Modal>
  )
}

/**
 * En qué paso se está, y cuántos faltan.
 *
 * Un stepper sin esto es un formulario que cambia solo: quien lo usa no sabe si
 * le quedan dos preguntas o diez, y esa incertidumbre es la que hace abandonar.
 */
function Progreso({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <div className="grid gap-2">
      <p className="aq-micro text-tenue">
        Paso {paso} de 3 · {PASOS[paso - 1]!.titulo}
      </p>
      <ol className="flex gap-1.5" aria-hidden>
        {PASOS.map(({ n }) => (
          <li
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= paso ? 'bg-accion' : 'bg-current/15'}`}
          />
        ))}
      </ol>
    </div>
  )
}

function Botones({
  paso,
  puedeAvanzar,
  enviando,
  hayTelefono,
  atras,
  siguiente,
  cerrar,
}: {
  paso: 1 | 2 | 3
  puedeAvanzar: boolean
  enviando: boolean
  hayTelefono: boolean
  atras: () => void
  siguiente: () => void
  cerrar: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-sutil pt-4">
      {paso === 3 ? (
        <button type="submit" disabled={enviando} className="aq-boton aq-boton-primario">
          {enviando ? 'Registrando…' : 'Registrar cliente'}
        </button>
      ) : (
        /*
          El botón del paso 2 DICE que se puede seguir sin teléfono. «Siguiente»
          a secas deja la duda de si el campo vacío va a rebotar, y en la duda
          alguien inventa un número.
        */
        <button
          type="button"
          onClick={siguiente}
          disabled={!puedeAvanzar}
          className="aq-boton aq-boton-primario"
        >
          {paso === 2 && !hayTelefono ? 'Seguir sin teléfono' : 'Siguiente'}
        </button>
      )}

      {paso > 1 ? (
        <button type="button" onClick={atras} className="aq-boton aq-boton-secundario">
          Atrás
        </button>
      ) : null}

      <button type="button" onClick={cerrar} className="aq-boton aq-boton-secundario ml-auto">
        Cancelar
      </button>
    </div>
  )
}
