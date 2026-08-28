import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Base, Cliente, Direccion, FichaDeCliente, MovimientoDeBase } from '@/lib/api-types'

/**
 * El historial de una base — RN-BAS-05.
 *
 * ── Estado e historia responden preguntas distintas ─────────────────────────
 *
 * La columna `direccion_id` dice **dónde está** la base hoy. Esto dice **cómo
 * llegó ahí**. Ninguna de las dos se deduce de la otra, y guardar las dos parece
 * redundante hasta que alguien discute un cobro.
 *
 * Esa es la conversación que esta pantalla existe para sostener: un cliente que
 * dice que la base ya estaba rota cuando se la llevaron. Sin el historial, la
 * respuesta es la palabra de uno contra la del otro.
 */
export default async function HistorialDeBasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [bases, movimientos, clientes] = await Promise.all([
    apiServerFetch<Base[]>('/bases'),
    apiServerFetch<MovimientoDeBase[]>(`/bases/${id}/historial`),
    apiServerFetch<Cliente[]>('/clientes'),
  ])
  const leidoEn = new Date()

  /*
   * `GET /bases` solo trae las activas. Una base descartada no está ahí y su
   * historial SÍ existe — es justamente el caso en que hay que consultarlo.
   * Por eso la ausencia no es un 404 si hay movimientos.
   */
  const base = bases.find((b) => b.id === id)
  if (!base && movimientos.length === 0) notFound()

  /*
   * Las direcciones cuelgan de cada cliente, así que hay que preguntarle a cada
   * uno para poder traducir el `direccionId` de un préstamo a un lugar con
   * nombre. Un UUID en pantalla no le dice nada a nadie.
   */
  const direcciones: (Direccion & { cliente: Cliente })[] = (
    await Promise.all(
      clientes.map(async (cliente) => {
        const ficha = await apiServerFetch<FichaDeCliente>(`/clientes/${cliente.id}`)
        return (ficha.direcciones ?? []).map((d) => ({ ...d, cliente }))
      }),
    )
  ).flat()

  const lugarDe = (direccionId: string | null) => {
    if (!direccionId) return null
    const d = direcciones.find((x) => x.id === direccionId)
    return d ? `${d.cliente.nombre} — ${d.etiqueta}, ${d.direccion}` : null
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link href="/modulos/retornables" className="aq-micro text-tenue hover:text-secundario">
          ← Retornables
        </Link>

        <h1 className="aq-titulo-pantalla text-principal">
          Base <span className="aq-cifra">{base?.idSticker ?? id}</span>
        </h1>

        <p className="text-[15px] text-secundario">
          {base
            ? base.estado === 'danada'
              ? 'Marcada como dañada. Ya no se presta: el próximo cliente respondería por un daño que ya se cobró.'
              : base.direccionId
                ? 'Prestada. Se reclama yendo a la dirección de abajo.'
                : 'En la bodega, lista para prestar.'
            : 'Fuera del parque. Su historial sigue acá porque los cargos que generó apuntan a ella.'}
        </p>
      </header>

      <ol className="grid gap-3">
        {movimientos.map((m) => {
          const lugar = lugarDe(m.direccionId)

          return (
            <li key={m.id}>
              <article className="aq-tarjeta grid gap-1 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold text-principal">{QUE_PASO[m.tipo]}</p>
                  <SelloDeHora leidoEn={new Date(m.createdAt)} />
                </div>

                {lugar ? <p className="text-[14px] text-secundario">{lugar}</p> : null}
                {m.motivo ? <p className="text-[14px] text-secundario">{m.motivo}</p> : null}
              </article>
            </li>
          )
        })}
      </ol>

      <SelloDeHora leidoEn={leidoEn} />
    </div>
  )
}

/**
 * El movimiento se nombra por lo que PASÓ, no por su tipo.
 *
 * `prestamo` es una etiqueta de base de datos; «Se prestó» es lo que ocurrió.
 * Quien lee este historial está reconstruyendo una secuencia de hechos, no
 * inspeccionando un enum.
 */
const QUE_PASO: Record<MovimientoDeBase['tipo'], string> = {
  alta: 'Entró al parque',
  prestamo: 'Se prestó',
  retorno: 'Volvió a la bodega',
  dano: 'Se registró un daño',
  descarte: 'Salió del parque',
}
