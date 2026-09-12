import { BotonDeAlta } from '@/components/clientes/boton-de-alta'
import { ListaDeClientes } from '@/components/clientes/lista-de-clientes'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Cliente, Departamento, Municipio } from '@/lib/api-types'

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
export default async function ClientesPage() {
  const [recientes, departamentos, municipios] = await Promise.all([
    /*
     * Solo los últimos diez, no el padrón entero. Traerlos todos para filtrar
     * en el navegador era lo que había, y con cinco mil clientes son cinco mil
     * filas viajando para mostrar veinte. La búsqueda ahora la hace `api`.
     */
    apiServerFetch<Cliente[]>('/clientes?recientes=10'),
    /*
     * El catálogo de geografía viaja como props porque el alta ahora ofrece
     * cargar la dirección apenas se crea el cliente. Va desde el servidor y no
     * con un `fetch` del navegador: ADR-0002 — el browser nunca toca `api/`.
     */
    apiServerFetch<Departamento[]>('/geografia/departamentos'),
    apiServerFetch<Municipio[]>('/geografia/municipios'),
  ])
  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Clientes</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Quién compra, con qué documento y si alguien lo comprobó.
        </p>
      </header>

      {/*
        El botón va ARRIBA, con el encabezado, y no al fondo.

        Registrar un cliente es la acción primaria de esta pantalla: si queda
        debajo de la lista, hay que recorrer veinte tarjetas para encontrarla, y
        con quinientas no se encuentra nunca.
      */}
      <BotonDeAlta departamentos={departamentos} municipios={municipios} />

      <ListaDeClientes recientes={recientes} />
      <SelloDeHora leidoEn={leidoEn} />
    </div>
  )
}
