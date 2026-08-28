import {
  ComprarBases,
  DarDeAltaBase,
  ListaDeBases,
  PrestarBase,
} from '@/components/retornables/bases'
import { AvisoDeBases } from '@/components/retornables/aviso-de-bases'
import { EstadoDelParque } from '@/components/retornables/estado-del-parque'
import {
  AjustarBotellones,
  ComprarBotellones,
  EntregaYRetorno,
} from '@/components/retornables/movimientos-de-botellon'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import { siPuedeVerlo } from '@/lib/permiso-opcional'
import type {
  Base,
  Cliente,
  Direccion,
  DisponibilidadDeBases,
  FichaDeCliente,
  ParqueDeBotellones,
} from '@/lib/api-types'

/**
 * Retornables — M7.
 *
 * ── Dos activos, dos secciones, y no se mezclan ─────────────────────────────
 *
 * El botellón se cuenta; la base se rastrea. Ponerlos juntos en una sola lista
 * obligaría a decidir en cada fila si el ID importa, y la respuesta depende del
 * activo — que es exactamente por qué son dos modelos y no uno.
 *
 * Arriba va el parque, porque es lo primero que hay que mirar: si la cuenta no
 * cierra, hay un botellón perdido y ninguna otra operación de esta pantalla es
 * más urgente.
 */
export default async function RetornablesPage() {
  const [parque, bases, clientes, proximo, disponibilidad] = await Promise.all([
    apiServerFetch<ParqueDeBotellones>('/botellones'),
    apiServerFetch<Base[]>('/bases'),
    apiServerFetch<Cliente[]>('/clientes'),
    /*
     * La propuesta del próximo sticker pide `bases:registrar`, y el `contador`
     * solo tiene `ver`. `siPuedeVerlo` se traga ese 403 para que la pantalla se
     * arme igual sin copiar acá la matriz de permisos — RN-ACC-02.
     */
    siPuedeVerlo(apiServerFetch<{ proximo: string }>('/bases/proximo-codigo')),
    apiServerFetch<DisponibilidadDeBases>('/bases/disponibilidad'),
  ])
  const leidoEn = new Date()

  /*
   * Las direcciones cuelgan de cada cliente, así que hay que preguntarle a cada
   * uno. Van en paralelo — son independientes entre sí.
   *
   * Se le pega el cliente a cada dirección porque en los desplegables «La casa»
   * a secas no identifica nada: hay una por cliente.
   */
  const direcciones: (Direccion & { cliente: Cliente })[] = (
    await Promise.all(
      clientes.map(async (cliente) => {
        const ficha = await apiServerFetch<FichaDeCliente>(`/clientes/${cliente.id}`)

        return ficha.direcciones.map((direccion) => ({ ...direccion, cliente }))
      }),
    )
  ).flat()

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Retornables</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Los botellones se cuentan; las bases se rastrean de a una. Son dos activos
          distintos y se manejan distinto.
        </p>
      </header>

      {/*
        Dos activos, DOS secciones, y cada una con todo lo suyo junto.

        Antes las cuatro tarjetas de botellones venían primero y las de base
        quedaban desperdigadas al final: prestar una base estaba en la posición
        seis de siete, después de la lista, y nadie la encontraba.

        El orden dentro de cada sección es el mismo: primero el estado —lo que
        hay que mirar—, después lo que se hace todos los días, y al final lo que
        pasa de vez en cuando (comprar, ajustar, dar de alta).
      */}
      <section className="grid gap-4">
        <h2 className="aq-micro text-tenue">Botellones</h2>

        <EstadoDelParque parque={parque} />

        <EntregaYRetorno clientes={clientes} />
        <ComprarBotellones />
        <AjustarBotellones clientes={clientes} />
      </section>

      <section className="grid gap-4">
        <h2 className="aq-micro text-tenue">
          Bases {bases.length > 0 ? `· ${bases.length}` : null}
        </h2>

        <AvisoDeBases disponibilidad={disponibilidad} hayBases={bases.length > 0} />

        <PrestarBase bases={bases} direcciones={direcciones} />

        <ListaDeBases bases={bases} direcciones={direcciones} />
        <SelloDeHora leidoEn={leidoEn} />

        <ComprarBases proximo={proximo?.proximo ?? null} />
        <DarDeAltaBase proximo={proximo?.proximo ?? null} />
      </section>
    </div>
  )
}
