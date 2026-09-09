'use client'

import { Search, UserPlus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { buscarClientesAction } from '@/app/(app)/modulos/clientes/actions'
import { AltaRapidaDeCliente } from '@/components/clientes/alta-rapida'
import type { Cliente } from '@/lib/api-types'

/**
 * Ubicar a un cliente por su número de documento.
 *
 * ── Por qué no es un `<select>` ─────────────────────────────────────────────
 *
 * Porque un `<select>` obliga a traerse TODOS los clientes para que alguien
 * elija uno. Con cuarenta funciona; con quinientos es una lista que nadie
 * recorre, y la página además carga quinientos registros que no va a usar.
 *
 * Y hay algo más de fondo: en el mostrador nadie busca «Pedro». Se pide la
 * cédula, y con ella se ubica a la persona. La pantalla ahora hace lo mismo que
 * hace la persona que atiende.
 *
 * ── El panel flotante NO lleva clase del sistema ────────────────────────────
 *
 * `.aq-tarjeta`, `.aq-menu-vidrio` y `.aq-vidrio-panel` declaran
 * `position: relative` en una regla sin capa, así que le ganan a la utilidad
 * `absolute` de Tailwind. Ese defecto ya rompió el armazón tres veces —está
 * documentado en `globals.css`— y acá dejaría la lista empujando el formulario
 * en vez de flotar sobre él.
 *
 * Por eso son dos elementos: uno posiciona y el otro se ve. El que posiciona no
 * tiene clase que se lo pueda sacar.
 *
 * ── El mínimo de tres, dos veces y a propósito ──────────────────────────────
 *
 * `api/` no busca con menos de tres caracteres porque con uno o dos devolvería
 * casi toda la tabla. Acá el mínimo existe por otra razón: no disparar una
 * consulta por cada tecla.
 *
 * Son dos motivos distintos para el mismo número, y viven en repos separados
 * —no hay test que pueda cruzarlos—. La garantía es que este lado sea el más
 * estricto: si `api/` bajara su mínimo, la pantalla seguiría esperando tres y
 * no se rompe nada. Al revés sí importaría, y por eso no se sube este número
 * sin mirar el otro.
 */
const MINIMO = 3

/**
 * Cuánto se espera después de la última tecla.
 *
 * Sin esto, escribir una cédula de diez dígitos son ocho consultas de las que
 * siete ya no le importan a nadie. 250 ms es más de lo que tarda en escribirse
 * el siguiente dígito y menos de lo que se percibe como demora.
 */
const ESPERA = 250

export function BuscadorDeCliente({
  name = 'clienteId',
  etiqueta = 'Cliente',
  sinCliente,
  elegido,
  onElegir,
}: {
  /** El campo que viaja en el formulario. Lleva el id, no el documento. */
  name?: string
  etiqueta?: string
  /**
   * Qué significa no elegir a nadie —«Sin cliente», «En la bodega»—.
   *
   * `undefined` es «hace falta uno»: no se ofrece el atajo para seguir sin
   * elegir, y quien reciba este componente tiene que bloquear su propio envío.
   * Un `<input type="hidden">` no se puede marcar `required`: el navegador no
   * valida lo que no se ve.
   */
  sinCliente?: string
  elegido: Cliente | null
  onElegir: (cliente: Cliente | null) => void
}) {
  const [registrando, setRegistrando] = useState(false)
  const idCampo = useId()
  const idLista = useId()
  const idAyuda = useId()

  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [resaltado, setResaltado] = useState(0)
  const [buscando, empezarBusqueda] = useTransition()

  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /**
   * La última consulta que se disparó.
   *
   * Dos búsquedas en vuelo pueden volver al revés: «123» tarda más que «1234» y
   * pisa sus resultados. Sin esta guarda, quien escribe rápido ve la lista de
   * lo que escribió hace dos teclas.
   */
  const ultima = useRef('')

  /*
   * El debounce que quedó pendiente se cancela al desmontar.
   *
   * Sin esto, salir de la pantalla con una búsqueda a medio escribir igual
   * dispara la consulta un cuarto de segundo después, contra un componente que
   * ya no existe. Lo delató un test que se contaminó con la búsqueda del test
   * anterior: el temporizador sobrevivía al desmontaje.
   */
  useEffect(() => () => clearTimeout(temporizador.current), [])

  const soloAlfanumerico = (valor: string) => valor.replaceAll(/[^0-9A-Za-z]/g, '')
  const consulta = soloAlfanumerico(texto)
  const abierto = elegido === null && consulta.length >= MINIMO

  function alEscribir(valor: string) {
    setTexto(valor)
    setResaltado(0)

    clearTimeout(temporizador.current)

    const limpio = soloAlfanumerico(valor)
    ultima.current = limpio

    if (limpio.length < MINIMO) {
      setResultados([])
      return
    }

    temporizador.current = setTimeout(() => {
      empezarBusqueda(async () => {
        const encontrados = await buscarClientesAction(limpio)
        if (ultima.current !== limpio) return
        setResultados(encontrados)
      })
    }, ESPERA)
  }

  function elegir(cliente: Cliente) {
    clearTimeout(temporizador.current)
    ultima.current = ''
    setTexto('')
    setResultados([])
    onElegir(cliente)
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto) return

    /*
     * Enter NUNCA llega al formulario mientras la lista está abierta.
     *
     * Este campo vive dentro del formulario de venta: sin este freno, escribir
     * una cédula y apretar Enter cobra la venta antes de haber elegido a nadie.
     */
    if (evento.key === 'Enter') {
      evento.preventDefault()
      const cliente = resultados[resaltado]
      if (cliente) elegir(cliente)
      return
    }

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setResaltado((i) => Math.min(i + 1, resultados.length - 1))
      return
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setResaltado((i) => Math.max(i - 1, 0))
      return
    }

    if (evento.key === 'Escape') {
      evento.preventDefault()
      setTexto('')
      setResultados([])
    }
  }

  if (elegido) {
    return (
      <div className="aq-etiqueta-campo">
        <input type="hidden" name={name} value={elegido.id} />
        <span>{etiqueta}</span>

        <div className="flex items-center justify-between gap-3 rounded-md bg-elevada px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-principal">{elegido.nombre}</span>
            <span className="aq-cifra block text-[13px] text-tenue">{elegido.documento}</span>
          </span>

          <button
            type="button"
            onClick={() => onElegir(null)}
            className="aq-boton aq-boton-secundario aq-boton-compacto shrink-0"
          >
            <X aria-hidden className="size-4" />
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="aq-etiqueta-campo">
      {/* Va vacío igual: sin el campo, el `FormData` no trae la clave y el
          servidor no puede distinguir «sin cliente» de «alguien lo borró». */}
      <input type="hidden" name={name} value="" />

      <label htmlFor={idCampo}>
        {etiqueta}{' '}
        {sinCliente ? <span className="font-normal normal-case">(opcional)</span> : null}
      </label>

      {/* Este div ancla al panel: `relative` acá es lo que hace que el
          `absolute` de adentro se mida contra el campo y no contra la página. */}
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-icono"
        />
        <input
          id={idCampo}
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-describedby={idAyuda}
          aria-activedescendant={
            abierto && resultados[resaltado] ? `${idLista}-${resaltado}` : undefined
          }
          autoComplete="off"
          inputMode="numeric"
          placeholder="Número de documento"
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          onKeyDown={alTeclear}
          className="aq-campo aq-campo-con-icono aq-cifra"
        />

        {abierto ? (
          /*
            DOS divs, y no es un envoltorio de más.

            El de afuera posiciona y NO lleva clase del sistema. El de adentro
            se ve. `.aq-menu-vidrio` declara `position: relative` sin capa, así
            que puesta sobre el elemento posicionado le gana a `absolute` de
            Tailwind: el panel deja de flotar y empuja «Cómo paga» hacia abajo
            en cada tecla. Se probó juntándolas, y pasa.
          */
          <div className="absolute top-full right-0 left-0 z-10 mt-1">
            <div className="aq-panel-flotante p-1">
            <ul
              id={idLista}
              role="listbox"
              aria-label={etiqueta}
              className="max-h-72 overflow-y-auto"
            >
              {resultados.map((cliente, i) => (
                <li
                  key={cliente.id}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === resaltado}
                  /*
                   * `onMouseDown` y no `onClick`: al soltar el botón el input ya
                   * perdió el foco y la lista se cerró, así que el clic aterriza
                   * en el aire. Es el defecto clásico del desplegable a mano.
                   */
                  onMouseDown={(e) => {
                    e.preventDefault()
                    elegir(cliente)
                  }}
                  onMouseEnter={() => setResaltado(i)}
                  className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 ${
                    i === resaltado ? 'aq-panel-flotante-resaltado' : ''
                  }`}
                >
                  {/* Sin clase de color: el color lo pone la fila, para que el
                      resaltado pueda cambiarlo. Ver `.aq-panel-flotante`. */}
                  <span className="min-w-0 truncate text-[15px]">{cliente.nombre}</span>
                  <span className="aq-cifra aq-panel-flotante-secundario shrink-0 text-[13px]">
                    {cliente.documento}
                  </span>
                </li>
              ))}

              {resultados.length === 0 ? (
                <li className="aq-panel-flotante-secundario flex min-h-11 items-center px-3 text-[13px]">
                  {buscando ? 'Buscando…' : 'Nadie con ese documento.'}
                </li>
              ) : null}
            </ul>

            {/*
              Registrar va DENTRO del panel pero FUERA del `listbox`.

              Fuera del `listbox`, porque un `<button>` entre `role="option"`
              rompe el patrón: un lector de pantalla anuncia «lista de 3» y el
              tercero no es una opción, y las flechas lo saltarían.

              Dentro del panel, porque afuera no se podía usar. Estaba abajo, en
              el flujo normal, y el panel —que es `absolute`— le caía encima: el
              texto se leía superpuesto y el clic aterrizaba en la lista. Ningún
              test lo vio, porque jsdom no hace layout: ahí nada se superpone
              nunca. Apareció abriendo la pantalla.
            */}
            {!buscando && resultados.length === 0 ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  // Igual que las opciones: al soltar, el input ya perdió el
                  // foco y el panel se cerró, así que el clic cae en el aire.
                  e.preventDefault()
                  setRegistrando(true)
                }}
                className="aq-boton aq-boton-secundario aq-boton-compacto mt-1 w-full"
              >
                <UserPlus aria-hidden className="size-4" />
                Registrar a esta persona
              </button>
            ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/*
        Se monta recién al abrirlo, y esto NO es una optimización.

        `AltaRapidaDeCliente` arranca su campo de documento con
        `useState(documentoInicial)`, y `useState` solo mira ese valor la
        primera vez. Montado desde el principio, esa primera vez es con la
        búsqueda vacía: el documento que la persona acaba de escribir nunca
        llegaba, y había que dictarlo de nuevo.
        
        El test no lo vio porque montaba el diálogo con el documento ya puesto
        — un estado que el flujo real no tiene nunca.
        
        Es además lo que `Modal` dice de sí mismo: montar de nuevo sale más
        barato que acordarse de limpiar.
      */}
      {registrando ? (
        <AltaRapidaDeCliente
          abierto
          cerrar={() => setRegistrando(false)}
          documentoInicial={consulta}
          alRegistrar={(cliente) => {
            setTexto('')
            setResultados([])
            onElegir(cliente)
          }}
        />
      ) : null}

      <p id={idAyuda} className="font-normal normal-case text-[13px] text-tenue">
        {consulta.length > 0 && consulta.length < MINIMO
          ? `Escriba al menos ${MINIMO} números.`
          : (sinCliente ?? 'Ubique a la persona por su documento.')}
      </p>
    </div>
  )
}
