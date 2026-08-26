import { Encabezados, Etiqueta, SinResultados, Tabla, Td, Th } from '@/components/ui/tabla'
import { QuitarFiltros } from '@/components/ui/vacio'
import { apiServerFetch } from '@/lib/api-server'
import type { PaginaDeAuditoria, RegistroDeAuditoria } from '@/lib/api-types'

/**
 * Consulta de la bitácora.
 *
 * Un solo componente para `admin` y `contador`: los dos ven exactamente lo
 * mismo. El alcance lo resuelve `api/` con `scopedCondition` (RN-ACC-03), así
 * que la pantalla no ramifica por rol — si algún día un rol viera menos, esta
 * vista no cambia.
 *
 * Todo server-rendered: los filtros viajan por query string y la paginación es
 * por cursor. Cero JavaScript en el browser para una pantalla de consulta.
 */

export interface FiltrosDeAuditoria {
  action?: string | undefined
  resource?: string | undefined
  result?: string | undefined
  userId?: string | undefined
  desde?: string | undefined
  hasta?: string | undefined
  cursor?: string | undefined
}

const CAMPOS_DE_FILTRO = ['action', 'resource', 'result', 'userId', 'desde', 'hasta'] as const

function armarQuery(filtros: FiltrosDeAuditoria): string {
  const params = new URLSearchParams()

  for (const campo of CAMPOS_DE_FILTRO) {
    const valor = filtros[campo]
    if (valor) params.set(campo, valor)
  }
  if (filtros.cursor) params.set('cursor', filtros.cursor)

  return params.toString()
}

export async function VistaDeAuditoria({
  filtros,
  ruta,
}: {
  filtros: FiltrosDeAuditoria
  /** Ruta de esta pantalla, para que los links de filtro y paginación vuelvan acá. */
  ruta: string
}) {
  const query = armarQuery(filtros)
  const pagina = await apiServerFetch<PaginaDeAuditoria>(`/audit${query ? `?${query}` : ''}`)

  // El link de "cargar más" conserva los filtros: sin esto, pasar de página
  // los perdería y el usuario volvería al log completo sin entender por qué.
  const siguiente = pagina.siguienteCursor
    ? `${ruta}?${armarQuery({ ...filtros, cursor: String(pagina.siguienteCursor) })}`
    : null

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Auditoría</h1>
        <p className="mt-1 text-sm text-tenue">
          Registro inmutable de las acciones sensibles del sistema.
        </p>
      </header>

      <Filtros filtros={filtros} ruta={ruta} />

      <Tabla>
        <Encabezados>
          {/* El ancla: sin ella, scrollear a «Detalle» deja la fila sin de cuándo era. */}
          <Th fija>Fecha</Th>
          <Th>Usuario</Th>
          <Th>Acción</Th>
          <Th>Resultado</Th>
          <Th>Detalle</Th>
        </Encabezados>
        <tbody>
          {pagina.filas.length === 0 ? (
            <SinResultados columnas={5}>
              {/*
                R50 · Un vacío de filtro NUNCA sugiere crear. Acá ni siquiera
                tendría sentido —la auditoría no se escribe a mano— pero lo que
                sí faltaba era la salida: decir «no hay nada» sin ofrecer cómo
                volver deja a la persona reescribiendo filtros a ciegas.
              */}
              <span className="grid justify-items-center gap-3">
                No hay registros que coincidan con estos filtros.
                <QuitarFiltros href={ruta} />
              </span>
            </SinResultados>
          ) : (
            pagina.filas.map((fila) => <FilaDeRegistro key={fila.id} fila={fila} />)
          )}
        </tbody>
      </Tabla>

      {siguiente ? (
        <a
          href={siguiente}
          // Enlace con forma de botón: es una acción suelta, así que lleva el
          // objetivo táctil mínimo (R54). La regla global no toca los enlaces
          // porque uno dentro de una oración no puede medir 44 px.
          className="aq-boton aq-boton-secundario justify-self-start"
        >
          Cargar más ↓
        </a>
      ) : (
        // Solo se dice cuando hay algo que terminar de ver: en una tabla vacía
        // el mensaje sobra.
        pagina.filas.length > 0 && (
          <p className="text-sm text-secundario">No hay más registros.</p>
        )
      )}
    </div>
  )
}

function FilaDeRegistro({ fila }: { fila: RegistroDeAuditoria }) {
  return (
    <tr>
      <Td fija className="whitespace-nowrap tabular-nums text-secundario">
        {new Date(fila.createdAt).toLocaleString('es-CO', {
          dateStyle: 'short',
          timeStyle: 'medium',
        })}
      </Td>

      <Td>
        {fila.userName ? (
          <>
            <span>{fila.userName}</span>
            <p className="text-sm text-tenue">{fila.userEmail}</p>
          </>
        ) : fila.userId ? (
          // El registro sobrevivió al borrado del usuario: `audit_log` no tiene
          // FK a `users` justamente para esto. Decirlo es mejor que una celda
          // vacía que parece un dato faltante.
          <span className="text-tenue italic">(cuenta eliminada)</span>
        ) : (
          <span className="text-tenue italic">(sin sesión)</span>
        )}
        {fila.rolEjercido && fila.rolEjercido.length > 0 ? (
          <p className="text-sm text-secundario">{fila.rolEjercido.join(', ')}</p>
        ) : null}
      </Td>

      <Td className="aq-cifra whitespace-nowrap text-sm">{fila.action}</Td>

      <Td>
        {/*
          Permitido va en el verde reservado: la acción estaba autorizada y el
          sistema la dejó pasar, que es literalmente «todo en orden».

          Denegado va en rojo y no en ámbar: no es una advertencia, es alguien
          que intentó algo que no podía. Es la fila que hay que poder encontrar
          de un vistazo en una tabla larga.
        */}
        <Etiqueta tono={fila.result === 'ok' ? 'ok' : 'alerta'}>
          {fila.result === 'ok' ? 'Permitido' : 'Denegado'}
        </Etiqueta>
      </Td>

      <Td className="max-w-md">
        {fila.payload ? (
          <code className="block truncate text-sm text-secundario">
            {JSON.stringify(fila.payload)}
          </code>
        ) : null}
        {fila.ip ? <p className="text-sm text-secundario">{fila.ip}</p> : null}
      </Td>
    </tr>
  )
}

/**
 * Filtros por GET.
 *
 * Un formulario que navega en vez de un componente con estado: los filtros
 * quedan en la URL, así se pueden compartir, guardar en favoritos y volver
 * atrás con el botón del browser. Nada de esto funciona con estado en memoria.
 */
function Filtros({ filtros, ruta }: { filtros: FiltrosDeAuditoria; ruta: string }) {
  return (
    /*
      Es una tarjeta del sistema, no un recuadro con borde.

      Estaba como `rounded-lg border border-sutil`: un rectángulo dibujado
      encima del agua, sin relación con ninguna otra superficie de la app. Con
      `aq-tarjeta` es la misma lámina que el resto y los campos se hunden en
      ella, que es lo que hace que se lean como campos.
    */
    <form action={ruta} method="get" className="aq-tarjeta grid gap-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="aq-etiqueta-campo">
          <span>Acción</span>
          <input
            name="action"
            defaultValue={filtros.action ?? ''}
            placeholder="ventas:anular"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Módulo</span>
          <input
            name="resource"
            defaultValue={filtros.resource ?? ''}
            placeholder="usuarios"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Resultado</span>
          <select name="result" defaultValue={filtros.result ?? ''} className="aq-campo">
            <option value="">Todos</option>
            <option value="ok">Permitidos</option>
            {/* Ver solo los denegados es la consulta de seguridad más útil. */}
            <option value="denied">Denegados</option>
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Desde</span>
          <input name="desde" type="date" defaultValue={filtros.desde ?? ''} className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Hasta</span>
          <input name="hasta" type="date" defaultValue={filtros.hasta ?? ''} className="aq-campo" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="aq-boton aq-boton-primario">
          Filtrar
        </button>
        {/* Un link y no un reset: `reset` devuelve los campos a sus valores
            iniciales, que son justamente los filtros aplicados. */}
        <a href={ruta} className="aq-boton aq-boton-secundario">
          Limpiar
        </a>
      </div>
    </form>
  )
}
