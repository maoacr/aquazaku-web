import { Encabezados, Etiqueta, SinResultados, Tabla, Td, Th } from '@/components/ui/tabla'
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
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="mt-1 text-sm text-tenue">
          Registro inmutable de las acciones sensibles del sistema.
        </p>
      </header>

      <Filtros filtros={filtros} ruta={ruta} />

      <Tabla>
        <Encabezados>
          <Th>Fecha</Th>
          <Th>Usuario</Th>
          <Th>Acción</Th>
          <Th>Resultado</Th>
          <Th>Detalle</Th>
        </Encabezados>
        <tbody>
          {pagina.filas.length === 0 ? (
            <SinResultados columnas={5}>
              No hay registros que coincidan con estos filtros.
            </SinResultados>
          ) : (
            pagina.filas.map((fila) => <FilaDeRegistro key={fila.id} fila={fila} />)
          )}
        </tbody>
      </Tabla>

      {siguiente ? (
        <a
          href={siguiente}
          className="justify-self-start rounded border border-fuerte px-4 py-2 text-sm"
        >
          Cargar más ↓
        </a>
      ) : (
        // Solo se dice cuando hay algo que terminar de ver: en una tabla vacía
        // el mensaje sobra.
        pagina.filas.length > 0 && (
          <p className="text-xs text-secundario">No hay más registros.</p>
        )
      )}
    </div>
  )
}

function FilaDeRegistro({ fila }: { fila: RegistroDeAuditoria }) {
  return (
    <tr>
      <Td className="whitespace-nowrap tabular-nums text-secundario">
        {new Date(fila.createdAt).toLocaleString('es-CO', {
          dateStyle: 'short',
          timeStyle: 'medium',
        })}
      </Td>

      <Td>
        {fila.userName ? (
          <>
            <span>{fila.userName}</span>
            <p className="text-xs text-tenue">{fila.userEmail}</p>
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
          <p className="text-xs text-secundario">{fila.rolEjercido.join(', ')}</p>
        ) : null}
      </Td>

      <Td className="whitespace-nowrap font-mono text-xs">{fila.action}</Td>

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
          <code className="block truncate text-xs text-secundario">
            {JSON.stringify(fila.payload)}
          </code>
        ) : null}
        {fila.ip ? <p className="text-xs text-secundario">{fila.ip}</p> : null}
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
    <form
      action={ruta}
      method="get"
      className="grid gap-3 rounded-lg border border-sutil p-4 sm:grid-cols-5"
    >
      <label className="grid gap-1 text-xs">
        <span className="text-secundario">Acción</span>
        <input
          name="action"
          defaultValue={filtros.action ?? ''}
          placeholder="ventas:anular"
          className="rounded border border-fuerte bg-transparent px-2 py-1.5 text-sm"
        />
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-secundario">Módulo</span>
        <input
          name="resource"
          defaultValue={filtros.resource ?? ''}
          placeholder="usuarios"
          className="rounded border border-fuerte bg-transparent px-2 py-1.5 text-sm"
        />
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-secundario">Resultado</span>
        <select
          name="result"
          defaultValue={filtros.result ?? ''}
          className="rounded border border-fuerte bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <option value="ok">Permitidos</option>
          {/* Ver solo los denegados es la consulta de seguridad más útil. */}
          <option value="denied">Denegados</option>
        </select>
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-secundario">Desde</span>
        <input
          name="desde"
          type="date"
          defaultValue={filtros.desde ?? ''}
          className="rounded border border-fuerte bg-transparent px-2 py-1.5 text-sm"
        />
      </label>

      <label className="grid gap-1 text-xs">
        <span className="text-secundario">Hasta</span>
        <input
          name="hasta"
          type="date"
          defaultValue={filtros.hasta ?? ''}
          className="rounded border border-fuerte bg-transparent px-2 py-1.5 text-sm"
        />
      </label>

      <div className="flex items-end gap-2 sm:col-span-5">
        <button
          type="submit"
          className="rounded bg-accion px-4 py-2 text-sm font-medium text-invertido"
        >
          Filtrar
        </button>
        {/* Un link y no un reset: `reset` devuelve los campos a sus valores
            iniciales, que son justamente los filtros aplicados. */}
        <a href={ruta} className="rounded border border-fuerte px-4 py-2 text-sm">
          Limpiar
        </a>
      </div>
    </form>
  )
}
