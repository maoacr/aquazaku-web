import { AltaDeCliente } from '@/components/clientes/alta-cliente'
import { TarjetasDeClientes } from '@/components/clientes/tarjetas-de-clientes'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Cliente } from '@/lib/api-types'

/**
 * Clientes — M5.
 *
 * El acceso lo decide `api/`: si un rol sin permiso llega hasta acá,
 * `apiServerFetch` recibe 403 y lanza. Esta página no vuelve a chequear el rol
 * porque hacerlo sugeriría que ESA es la barrera (RN-ACC-02).
 *
 * ── El filtro es del servidor, sobre datos ya traídos ───────────────────────
 *
 * Con el volumen actual —decenas de clientes— traerlos todos y filtrar acá es
 * más simple y más rápido que un endpoint de búsqueda: no hay ida y vuelta por
 * cada tecla. Cuando la lista crezca, el filtro se muda a `api/` y esta página
 * casi no cambia.
 */
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  const { q, estado } = await searchParams
  const verTodos = estado === 'todos'

  const clientes = await apiServerFetch<Cliente[]>(
    verTodos ? '/clientes?estado=todos' : '/clientes',
  )
  const leidoEn = new Date()

  const busqueda = (q ?? '').trim().toLowerCase()
  const visibles = busqueda
    ? clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(busqueda) ||
          // Se busca contra el número BASE, no contra el documento armado: quien
          // teclea `79123456` tiene que encontrarlo aunque en pantalla diga
          // `79123456-0`.
          c.numeroDocumento.includes(busqueda.replace(/\D/g, '')),
      )
    : clientes

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Clientes</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Quién compra, con qué documento y si alguien lo comprobó.
        </p>
      </header>

      <form className="aq-tarjeta flex flex-wrap items-end gap-4 p-5">
        <label className="aq-etiqueta-campo min-w-[16rem] flex-1">
          <span>Buscar</span>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nombre o número de documento"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Estado</span>
          <select name="estado" defaultValue={estado ?? 'activos'} className="aq-campo">
            <option value="activos">Solo activos</option>
            <option value="todos">Todos</option>
          </select>
        </label>

        <button type="submit" className="aq-boton aq-boton-secundario">
          Filtrar
        </button>
      </form>

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">
          {visibles.length === 1 ? '1 cliente' : `${visibles.length} clientes`}
        </h2>
        <TarjetasDeClientes clientes={visibles} hayFiltro={busqueda.length > 0} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>

      <AltaDeCliente />
    </div>
  )
}
