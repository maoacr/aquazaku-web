import { AvisoDeVencidas } from '@/components/proveedores/aviso-de-vencidas'
import {
  CrearProveedor,
  ListaDeProveedores,
  RegistrarCompra,
} from '@/components/proveedores/proveedores'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { CompraVencida, InsumoListado, Proveedor } from '@/lib/api-types'
import { siPuedeVerlo } from '@/lib/permiso-opcional'

/**
 * Proveedores y compras — M9.
 *
 * ── Del lado de ENTRADA del negocio ────────────────────────────────────────
 *
 * Lo que se compra es insumos, botellones y bases. El agua no: esa se produce
 * en planta, y una compra que sumara producto terminado sería un error de
 * registro.
 *
 * ── Tres roles, tres pantallas distintas sin tres rutas ────────────────────
 *
 * El `contador` ve a quién se le compra y no registra nada; el `pos` registra
 * compras pero no da de alta proveedores; el `admin` hace todo. Eso no se
 * resuelve con condicionales sobre el rol: se resuelve pidiéndole a `api/` y
 * dejando que responda 403 donde corresponde (RN-ACC-02).
 *
 * `siPuedeVerlo` se traga ese 403 para que la pantalla se arme igual sin copiar
 * acá la matriz de permisos — la copia empezaría a mentir el día que la matriz
 * cambie, y lo haría en silencio.
 */
export default async function ProveedoresPage() {
  const [proveedores, insumos, vencidas] = await Promise.all([
    apiServerFetch<Proveedor[]>('/proveedores?incluirInactivos=si'),
    /*
     * Los insumos alimentan el desplegable de la compra. El `contador` no los
     * ve, y en ese caso la tarjeta de registrar compra tampoco aparece.
     */
    siPuedeVerlo(apiServerFetch<InsumoListado[]>('/insumos')),
    siPuedeVerlo(apiServerFetch<CompraVencida[]>('/compras/vencidas')),
  ])

  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="aq-titulo-pantalla text-principal">Proveedores</h1>
        <p className="text-[15px] text-secundario">
          A quién se le compra, qué llegó y cuánto costó. El agua no se compra: se produce.
        </p>
      </header>

      <AvisoDeVencidas vencidas={vencidas ?? []} />

      {/*
        Registrar la compra va PRIMERO: es lo que pasa todos los días. Cargar un
        proveedor pasa una vez cada tanto, y va al final por eso — el mismo
        orden que en retornables.
      */}
      {insumos ? <RegistrarCompra proveedores={proveedores} insumos={insumos} /> : null}

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">
          {proveedores.length === 1 ? '1 proveedor' : `${proveedores.length} proveedores`}
        </h2>

        <ListaDeProveedores proveedores={proveedores} puedeEditar={insumos !== null} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>

      {insumos ? <CrearProveedor /> : null}
    </div>
  )
}
