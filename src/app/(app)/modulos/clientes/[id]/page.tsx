import { ArrowLeft, MapPin } from 'lucide-react'
import { EditarDireccion } from '@/components/clientes/editar-direccion'
import Link from 'next/link'
import { BotonDeDireccion } from '@/components/clientes/boton-de-direccion'
import {
  TelefonosDelCliente,
  CambiarEstado,
  ConfigurarCredito,
  VerificarDocumento,
} from '@/components/clientes/acciones-de-cliente'
import { nivelDeVerificacion } from '@/components/clientes/tarjetas-de-clientes'
import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import { apiServerFetch } from '@/lib/api-server'
import type {
  Departamento,
  Municipio,
  Base,
  CarteraDeCliente,
  FichaDeCliente,
  MetodoDeVerificacion,
} from '@/lib/api-types'
import { siPuedeVerlo } from '@/lib/permiso-opcional'

/** Qué significa cada método, en palabras — RN-CLI-14. */
const METODO: Record<MetodoDeVerificacion, string> = {
  seller_manual: 'cotejado en la calle por quien vende',
  pos_manual: 'cotejado en el mostrador',
  admin_oficial: 'ratificado contra documento oficial',
}

/**
 * La ficha de un cliente.
 *
 * ── Los cuatro saldos NO muestran cero ──────────────────────────────────────
 *
 * RN-CLI-06 dice que un cliente tiene cuatro cuentas que no se mezclan: deuda,
 * botellones, bases y cargos pendientes. Las cuatro dependen de módulos que
 * todavía no existen — deuda y cargos son M6, botellones y bases son M7.
 *
 * Un cero diría «este cliente no debe nada». La verdad es «todavía no existe el
 * módulo que registra deudas», que es otra cosa. Es el mismo criterio que dejó
 * el caudal sin medir en `null` y no en cero.
 */
export default async function FichaDeClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  /*
   * ── La deuda se pide aparte, y puede no venir ────────────────────────────
   *
   * Vive bajo `cobros:ver` y no bajo `clientes:ver`: es información de cartera,
   * y quien ve un cliente no necesariamente ve lo que debe. El 403 decide, como
   * en el tablero — sin copiar la matriz acá.
   *
   * Las dos van en paralelo: son independientes y encadenarlas sumaría una
   * espera sin ganar nada.
   */
  const [cliente, cartera, botellones, departamentos, municipios] = await Promise.all([
    apiServerFetch<FichaDeCliente>(`/clientes/${id}`),
    siPuedeVerlo(apiServerFetch<CarteraDeCliente>(`/clientes/${id}/deuda`)),
    siPuedeVerlo(apiServerFetch<{ enPoderDelCliente: number }>(`/clientes/${id}/botellones`)),
    /*
     * El catálogo del DANE baja por props, no se pide desde el navegador: son
     * 10 KB comprimidos y así el formulario filtra sin esperar un viaje —y sin
     * un `fetch()` en el cliente, que el patrón BFF prohíbe (ADR-0002).
     */
    apiServerFetch<Departamento[]>('/geografia/departamentos'),
    apiServerFetch<Municipio[]>('/geografia/municipios'),
  ])
  const nivel = nivelDeVerificacion(cliente)

  /*
   * Las bases cuelgan de la DIRECCIÓN, no del cliente (`RN-BAS-03`), así que hay
   * que preguntarle a cada una. Van en paralelo entre sí; son independientes.
   *
   * Esa granularidad no es un detalle de implementación: una base hay que ir a
   * buscarla a un lugar concreto, y sin saber a cuál el préstamo deja de ser
   * reclamable.
   */
  const basesPorDireccion = await Promise.all(
    cliente.direcciones.map(async (direccion) => ({
      direccion,
      bases: (await siPuedeVerlo(apiServerFetch<Base[]>(`/direcciones/${direccion.id}/bases`))) ?? [],
    })),
  )
  const totalDeBases = basesPorDireccion.reduce((suma, d) => suma + d.bases.length, 0)

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/modulos/clientes"
          className="inline-flex items-center gap-1.5 text-[14px] text-secundario hover:text-principal"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Clientes
        </Link>
      </div>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="aq-titulo-pantalla text-principal">{cliente.nombre}</h1>
          <Estado tono={nivel}>
            {cliente.verificacionEstado === 'verificado' ? 'Verificado' : 'Sin verificar'}
          </Estado>
        </div>

        <p className="aq-bajada text-secundario">
          {cliente.tipoDocumento === 'CC' ? 'Cédula' : 'NIT'}{' '}
          <Cifra>{cliente.documento}</Cifra>
          {cliente.tipoDocumento === 'NIT' ? (
            <span className="ml-2 text-[13px] text-tenue">
              — el dígito después del guion lo calcula el sistema, no se guarda
            </span>
          ) : null}
        </p>

        {cliente.verificacionEstado === 'verificado' && cliente.verificacionMetodo ? (
          <p className="text-[13px] text-tenue">
            {METODO[cliente.verificacionMetodo]}
            {cliente.verificadoEn
              ? ` el ${new Date(cliente.verificadoEn).toLocaleDateString('es-CO')}`
              : ''}
            . Alguien respondió por este dato.
          </p>
        ) : null}
      </header>

      <section className="aq-tarjeta grid gap-4 p-5">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">Las cuatro cuentas</h2>
          <p className="mt-1 text-[13px] text-tenue">
            No se mezclan: un cliente puede estar al día con la plata y deberle quince
            botellones.
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-4">
          {/*
            La deuda YA tiene de dónde salir: es la primera de las cuatro que
            M6 llenó. Las otras tres siguen esperando a M7.

            Se muestra en pesos y no como una cantidad suelta: es plata, y una
            cifra sin `$` al lado de tres cifras de unidades se lee como
            unidades.
          */}
          <Cuenta
            termino="Deuda"
            valor={cartera ? `$${Number(cartera.deuda).toLocaleString('es-CO')}` : null}
            desde="ventas a crédito menos cobros"
            alerta={cartera !== null && Number(cartera.deuda) > 0}
          />
          {/*
            Los tres que M5 dejó en «sin registrar todavía». M7 los llenó, y cada
            uno viene de un lugar distinto a propósito: los botellones se cuentan
            por CLIENTE porque son fungibles; las bases por DIRECCIÓN porque hay
            que ir a buscarlas.
          */}
          <Cuenta
            termino="Botellones"
            valor={botellones?.enPoderDelCliente ?? null}
            desde="entregas menos retornos"
          />
          <Cuenta
            termino="Bases prestadas"
            valor={cliente.direcciones.length > 0 ? totalDeBases : null}
            desde="préstamos por dirección"
          />
          <Cuenta
            termino="Cargos pendientes"
            valor={
              cartera ? `$${Number(cartera.cargosPendientes).toLocaleString('es-CO')}` : null
            }
            desde="daños a una base"
            alerta={cartera !== null && Number(cartera.cargosPendientes) > 0}
          />
        </dl>
      </section>

      {/*
        Los teléfonos van ANTES de las direcciones: la pregunta más frecuente
        sobre un cliente abierto es «¿cómo lo llamo?», no «¿dónde vive?». Quien
        entra desde la cartera viene justamente a eso.
      */}
      <section className="aq-tarjeta grid gap-4 p-5">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">Teléfonos</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Toque un número para llamar. Uno por cada persona que atiende: el dueño y el local
            no son el mismo contacto.
          </p>
        </div>

        <TelefonosDelCliente clienteId={cliente.id} telefonos={cliente.telefonos} />
      </section>

      <section className="aq-tarjeta grid gap-4 p-5">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">Direcciones</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Cada base prestada se asigna a una dirección concreta. Sin eso, el préstamo
            deja de ser reclamable.
          </p>
        </div>

        {cliente.direcciones.length > 0 ? (
          <ul className="grid gap-2">
            {cliente.direcciones.map((d) => (
              <li key={d.id} className="flex items-start gap-2.5 rounded-lg border border-sutil p-3">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-icono" />
                <div className="min-w-0 flex-1">
                  {/*
                    La dirección entera es el objetivo del toque, no un ícono al
                    costado: un lápiz de dieciséis píxeles se falla con el pulgar,
                    y esto se usa desde un celular al lado de una llenadora.

                    `legible` la arma `api`: la nomenclatura se compone en un
                    solo lugar.
                  */}
                  <EditarDireccion
                    clienteId={cliente.id}
                    direccion={d}
                    departamentos={departamentos}
                    municipios={municipios}
                  />

                  {/*
                    Las bases van DEBAJO de su dirección y no en una lista
                    aparte. Es lo que hace reclamable el préstamo: la pregunta
                    que el operario se hace es «¿a cuál de sus tres locales voy a
                    buscar la 0913?».
                  */}
                  {(basesPorDireccion.find((b) => b.direccion.id === d.id)?.bases ?? []).map(
                    (base) => (
                      <p key={base.id} className="mt-1.5 flex items-center gap-2 text-[13px]">
                        <Cifra tono={base.estado === 'danada' ? 'alerta' : 'secundario'}>
                          {base.idSticker}
                        </Cifra>
                        <span className="text-tenue">
                          {base.estado === 'danada' ? 'base dañada, con recargo' : 'base prestada'}
                        </span>
                      </p>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-tenue">Todavía no tiene direcciones cargadas.</p>
        )}

        {/*
          El formulario va detrás del botón y no desplegado bajo la lista.

          Son doce campos, y esta ficha se abre para MIRAR: cuánto debe, a qué
          número llamarlo, a cuál de sus locales ir a buscar la 0913. Un
          formulario largo entre esos datos empuja el resto fuera de la
          pantalla — y esto se usa desde un celular al lado de una llenadora.
        */}
        <BotonDeDireccion
          clienteId={cliente.id}
          departamentos={departamentos}
          municipios={municipios}
        />
      </section>

      {cliente.verificacionEstado !== 'verificado' ? (
        <section className="aq-tarjeta grid gap-4 p-5">
          <h2 className="aq-titulo-tarjeta text-principal">Verificar el documento</h2>
          <VerificarDocumento cliente={cliente} />
        </section>
      ) : null}

      <section className="aq-tarjeta grid gap-4 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">Crédito</h2>
        <ConfigurarCredito cliente={cliente} />
      </section>

      <section className="aq-tarjeta grid gap-4 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">
          {cliente.activo ? 'Dar de baja' : 'Reactivar'}
        </h2>
        <CambiarEstado cliente={cliente} />
      </section>
    </div>
  )
}

/**
 * Una de las cuatro cuentas.
 *
 * Con `null` dice de dónde saldría el número cuando exista el módulo. Es más
 * útil que un guion: explica por qué está vacío en vez de dejarlo como un hueco.
 */
function Cuenta({
  termino,
  valor,
  desde,
  alerta = false,
}: {
  termino: string
  /** Ya formateado cuando es plata. `null` es «todavía no hay de dónde». */
  valor: number | string | null
  desde: string
  alerta?: boolean
}) {
  return (
    <div>
      <dt className="aq-micro text-tenue">{termino}</dt>
      <dd className="mt-1">
        {valor === null ? (
          <p className="text-[14px] text-tenue">Sin registrar todavía</p>
        ) : (
          <Cifra tamano="grande" tono={alerta ? 'alerta' : 'principal'}>
            {typeof valor === 'number' ? valor.toLocaleString('es-CO') : valor}
          </Cifra>
        )}
        <p className="mt-1 text-[13px] text-tenue">de {desde}</p>
      </dd>
    </div>
  )
}
