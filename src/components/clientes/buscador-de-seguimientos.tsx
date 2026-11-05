'use client'

import { Search, SearchX, X } from 'lucide-react'
import { useId, useState } from 'react'
import { ClientesParaLlamar } from '@/components/clientes/para-llamar'
import { Vacio } from '@/components/ui/vacio'
import {
  ETIQUETA_DE_CANAL,
  elOtroCanal,
  rutaDeCanal,
  type CanalDeSeguimiento,
} from '@/components/clientes/pestanas-de-seguimientos'
import type { DireccionALlamar, Producto, ResumenDeStock } from '@/lib/api-types'
import { filtrarSeguimientos } from '@/lib/buscar-seguimientos'

/**
 * Encontrar una fila en la lista de seguimientos.
 *
 * ── El problema ─────────────────────────────────────────────────────────────
 *
 * La lista es el padrón completo de direcciones que alguna vez compraron,
 * ordenado por días sin recibir. Eso la hace buena para recorrer de arriba
 * abajo marcando, que es para lo que se diseñó. Y la hace inservible para la
 * otra cosa que pasa todos los días: alguien llama, o pasa por el local, y hay
 * que ver cuándo pidió por última vez. Con cuarenta filas eso es scrollear
 * buscando un nombre a ojo.
 *
 * ── Por qué filtra acá y no en la URL ───────────────────────────────────────
 *
 * La pestaña vive en la URL (`?canal=otros`) y está bien que viva ahí: es
 * navegación entre dos vistas, se comparte y el botón de atrás funciona.
 *
 * Un término que se teclea no es navegación. Ponerlo en la URL volvería a
 * ejecutar la página en cada tecla, y la página pide TRES cosas —la lista, el
 * catálogo y el stock— con `cache: 'no-store'`. Serían tres viajes por letra
 * para filtrar un arreglo que ya está en el navegador. Las dos últimas
 * peticiones ni se usan para filtrar: las necesita el mostrador que abre el
 * lápiz.
 *
 * El costo de esta decisión es que la tabla viaja al bundle del cliente. Está
 * anotado en `para-llamar.tsx`, donde antes decía que no lo hacía.
 *
 * ── Y por qué no hay debounce ni mínimo de letras ───────────────────────────
 *
 * Los dos existen en el buscador de Clientes para no disparar una consulta por
 * tecla. Acá no hay consulta: el filtro es un `filter` sobre un arreglo de
 * decenas de elementos. Esperar 250 ms o tres caracteres sería hacer esperar a
 * cambio de nada.
 */
export function BuscadorDeSeguimientos({
  filas,
  enElOtroCanal,
  canal,
  basePath,
  productos,
  stock,
  consultaInicial,
}: {
  filas: DireccionALlamar[]
  /**
   * Las filas de la OTRA pestaña, para poder avisar que alguien está allá.
   *
   * No cuesta una petición: la pantalla ya pide los dos canales juntos porque
   * la cabecera muestra los dos conteos antes de que nadie elija pestaña.
   */
  enElOtroCanal: DireccionALlamar[]
  canal: CanalDeSeguimiento
  basePath: string
  productos: Producto[]
  stock: ResumenDeStock[]
  /** El `?q=` con el que se llegó, cuando se llegó siguiendo un aviso. */
  consultaInicial?: string
}) {
  const idCampo = useId()
  /*
   * `useState` mira este valor UNA sola vez, y acá alcanza: la pantalla se
   * remonta al cambiar de canal porque `page.tsx` le pone un `key` con el canal
   * y la consulta. Sin ese `key`, seguir el aviso dejaría el campo con el
   * término viejo — el mismo defecto que tuvo el alta del mostrador.
   */
  const [consulta, setConsulta] = useState(consultaInicial ?? '')

  const termino = consulta.trim()
  const hayFiltro = termino !== ''

  /*
   * Lo visible se DERIVA, no se guarda.
   *
   * Un `useState` con las filas filtradas tendría que sincronizarse cuando
   * `filas` cambia —y cambia: la pantalla revalida después de corregir una
   * venta—. Derivarlo hace que la lista nueva ya llegue filtrada, sin un efecto
   * que la persiga.
   */
  const visibles = filtrarSeguimientos(filas, consulta)

  /*
   * Lo que coincide en la OTRA pestaña, y solo cuando acá no quedó nada.
   *
   * Las dos pestañas son dos relojes distintos y la búsqueda NO los cruza: un
   * cliente al día en botellones y atrasado en pacas son dos hechos separados,
   * y mezclarlos desarmaría la única razón por la que esta pantalla tiene dos
   * canales.
   *
   * Lo que se arregla acá es el SILENCIO. «Ninguna dirección coincide» frente a
   * alguien que está a un clic se lee como «esta persona no está en
   * seguimientos». Medido en la base de desarrollo: 12 de los 17 clientes están
   * SOLO en botellones, así que parado en «Otros productos» hay doce personas
   * que el buscador declaraba inexistentes.
   *
   * Se calcula solo cuando hace falta: con resultados acá, el aviso sería ruido.
   */
  const otro = elOtroCanal(canal)
  const alla =
    hayFiltro && visibles.length === 0 ? filtrarSeguimientos(enElOtroCanal, consulta) : []

  /*
   * Sin filas no hay nada que filtrar, y un buscador vacío sobre una tabla
   * vacía es una pregunta sin respuesta posible. El mensaje de la tabla ya
   * explica por qué no hay nada.
   */
  if (filas.length === 0) {
    return <ClientesParaLlamar filas={filas} canal={canal} productos={productos} stock={stock} />
  }

  return (
    <div className="grid gap-3">
      <div className="aq-tarjeta grid gap-2 p-5">
        <label htmlFor={idCampo} className="aq-etiqueta-campo">
          <span>Buscar</span>
        </label>

        {/* `relative` acá, sin clase del sistema: `.aq-tarjeta` ya declara
            `position: relative` sin capa y le ganaría al `absolute` de adentro
            — el defecto que está documentado en `globals.css`. */}
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue"
          />
          <input
            id={idCampo}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            type="search"
            autoComplete="off"
            placeholder="Nombre, apodo, cédula o dirección"
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
          El conteo se DICE, y se anuncia.

          Filtrar sin ver cuántas quedaron obliga a contarlas a mano, que es
          justo el trabajo que el buscador vino a sacar. `aria-live` lo lleva a
          quien no está mirando la tabla.
        */}
        {/*
          El conteo se DICE, y se anuncia. Pero SOLO cuando hay algo que contar.

          Con la lista vacía el que habla es el bloque de abajo, que además
          lleva `role="status"`. Dos regiones vivas anunciando el mismo hecho se
          leen una arriba de la otra: el lector de pantalla dice «ninguna
          coincide» y acto seguido «no está en esta pestaña».
        */}
        <p aria-live="polite" className="text-[13px] text-tenue">
          {!hayFiltro
            ? 'Escriba para encontrar una dirección en la lista.'
            : visibles.length > 0
              ? textoDeResultados(visibles.length)
              : ''}
        </p>
      </div>

      {/*
        ── Con el filtro sin resultados, el vacío REEMPLAZA a la tabla ────────

        Antes el aviso era un renglón de 13 px arriba y abajo quedaba una tabla
        vacía con su propio mensaje. Dos problemas de una: lo único accionable
        de la pantalla pesaba menos que el placeholder, y la sugerencia de la
        tabla —«puede buscarla por nombre, por apodo…»— es ruido cuando el
        problema no es CÓMO se buscó sino DÓNDE está parado quien busca.

        Ahora ocupa el lugar que dejó la lista, que es donde cae el ojo cuando
        no hay filas. Es el mismo patrón de `TarjetasDeClientes`: con filtro y
        sin resultados, la lista se va y queda el `Vacio` con su salida.
      */}
      {hayFiltro && visibles.length === 0 ? (
        <Vacio
          variante="sin-resultados"
          icono={SearchX}
          titulo={alla.length > 0 ? 'No está en esta pestaña' : 'Ninguna dirección coincide'}
          hrefSinFiltros={rutaDeCanal(basePath, canal)}
          tambienEn={
            alla.length > 0
              ? { href: rutaDeCanal(basePath, otro, consulta), etiqueta: ETIQUETA_DE_CANAL[otro] }
              : undefined
          }
        >
          {alla.length > 0 ? (
            <>
              {alla.length === 1 ? (
                <>
                  <strong className="font-medium text-principal">{alla[0]!.nombre}</strong> aparece
                  en el otro canal
                </>
              ) : (
                <>
                  <strong className="font-medium text-principal">
                    {alla.length} direcciones
                  </strong>{' '}
                  coinciden en el otro canal
                </>
              )}
              , que lleva su propio reloj: un botellón se acaba en una semana y una paca de ochenta
              bolsas no.
            </>
          ) : (
            'Puede buscarla por su nombre, por su apodo, por su cédula o por su dirección.'
          )}
        </Vacio>
      ) : (
        <ClientesParaLlamar
          filas={visibles}
          canal={canal}
          productos={productos}
          stock={stock}
          hayFiltro={hayFiltro}
        />
      )}
    </div>
  )
}

/**
 * Concuerda en singular y plural sin el «(s)» que nadie dice hablando.
 *
 * Dice «dirección» y no «cliente» porque la fila ES una dirección: un cliente
 * con casa y local da dos filas, y decir «2 clientes» ahí sería falso. Esa
 * distinción es la razón de ser de esta pantalla.
 */
function textoDeResultados(cuantas: number): string {
  if (cuantas === 0) return 'Ninguna coincide.'
  if (cuantas === 1) return '1 dirección.'

  return `${cuantas} direcciones.`
}
