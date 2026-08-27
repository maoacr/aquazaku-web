import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import {
  AgregarDireccion,
  CambiarEstado,
  ConfigurarCredito,
  VerificarDocumento,
} from '@/components/clientes/acciones-de-cliente'
import { nivelDeVerificacion } from '@/components/clientes/tarjetas-de-clientes'
import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import { apiServerFetch } from '@/lib/api-server'
import type { DeudaDeCliente, FichaDeCliente, MetodoDeVerificacion } from '@/lib/api-types'
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
  const [cliente, cartera] = await Promise.all([
    apiServerFetch<FichaDeCliente>(`/clientes/${id}`),
    siPuedeVerlo(apiServerFetch<DeudaDeCliente>(`/clientes/${id}/deuda`)),
  ])
  const nivel = nivelDeVerificacion(cliente)

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
          <Cuenta termino="Botellones" valor={cliente.saldos.botellones} desde="entregas" />
          <Cuenta termino="Bases prestadas" valor={cliente.saldos.bases} desde="préstamos" />
          <Cuenta
            termino="Cargos pendientes"
            valor={cliente.saldos.cargosPendientes}
            desde="daños a una base"
          />
        </dl>
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
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-principal">{d.etiqueta}</p>
                  <p className="text-[14px] text-secundario">{d.direccion}</p>
                  {d.indicaciones ? (
                    <p className="mt-0.5 text-[13px] text-tenue">{d.indicaciones}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-tenue">Todavía no tiene direcciones cargadas.</p>
        )}

        <AgregarDireccion clienteId={cliente.id} />
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
