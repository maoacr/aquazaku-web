import { Contact } from 'lucide-react'
import Link from 'next/link'
import { Cifra } from '@/components/stock/cifra'
import { Estado, type Tono } from '@/components/ui/estado'
import { Vacio } from '@/components/ui/vacio'
import type { Cliente } from '@/lib/api-types'

/**
 * Los clientes, en tarjetas.
 *
 * Tarjetas y no tabla por lo mismo que usuarios: una tabla de seis columnas en
 * un teléfono obliga a scrollear en horizontal para leer una fila, y estos se
 * consultan parados en el mostrador.
 */

/**
 * El estado de verificación, en la escala de cobertura del sistema.
 *
 * `pendiente` es `justo` y no `expuesto`: nadie se equivocó. El documento está
 * registrado y la venta no se frena (RN-CLI-10) — lo que falta es que alguien
 * lo coteje. Pintarlo de rojo diría que hay un error donde hay un trámite.
 */
export function nivelDeVerificacion(cliente: Cliente): Tono {
  return cliente.verificacionEstado === 'verificado' ? 'cubierto' : 'justo'
}

const QUE_SIGNIFICA: Record<Tono, string> = {
  cubierto: 'Verificado',
  justo: 'Sin verificar',
  expuesto: 'Sin verificar',
}

const TIPO: Record<Cliente['tipo'], string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
}

export function TarjetasDeClientes({
  clientes,
  hayFiltro,
}: {
  clientes: Cliente[]
  hayFiltro: boolean
}) {
  if (clientes.length === 0) {
    /*
     * Los dos vacíos dicen cosas distintas (R50). Con filtro NUNCA se ofrece
     * crear: empujaría a cargar un cliente que ya existe porque se lo buscó
     * mal, y ese duplicado parte su deuda en dos.
     */
    return hayFiltro ? (
      <Vacio
        variante="sin-resultados"
        icono={Contact}
        titulo="Ningún cliente coincide"
        hrefSinFiltros="/modulos/clientes"
      >
        Puede buscar por nombre o por número de documento.
      </Vacio>
    ) : (
      <Vacio variante="primera-vez" icono={Contact} titulo="Todavía no hay clientes">
        Un cliente se registra con su documento desde el primer momento. Comprobarlo puede
        esperar; el dato no.
      </Vacio>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {clientes.map((cliente) => (
        <li key={cliente.id}>
          <TarjetaDeCliente cliente={cliente} />
        </li>
      ))}
    </ul>
  )
}

function TarjetaDeCliente({ cliente }: { cliente: Cliente }) {
  const nivel = nivelDeVerificacion(cliente)

  return (
    <Link href={`/modulos/clientes/${cliente.id}`} className="aq-tarjeta block h-full p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="aq-titulo-tarjeta truncate text-principal">{cliente.nombre}</p>
          {/*
            El documento va en mono con `tabular-nums`: es un código que alguien
            va a comparar dígito por dígito contra una cédula en la mano.
          */}
          <p className="mt-0.5 text-[13px] text-tenue">
            {cliente.tipoDocumento} <Cifra tono="secundario">{cliente.documento}</Cifra>
          </p>
        </div>
        <Contact aria-hidden className="size-5 shrink-0 text-icono" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Estado tono={nivel}>{QUE_SIGNIFICA[nivel]}</Estado>

        <span className="aq-micro rounded-full px-2.5 py-1 text-tenue ring-1 ring-inset ring-sutil">
          {TIPO[cliente.tipo]}
        </span>

        {cliente.creditoHabilitado ? (
          <span className="aq-micro rounded-full px-2.5 py-1 text-secundario ring-1 ring-inset ring-sutil">
            Crédito{' '}
            {cliente.creditoLimite === null
              ? 'sin tope'
              : `$${Number(cliente.creditoLimite).toLocaleString('es-CO')}`}
          </span>
        ) : null}

        {!cliente.activo ? (
          <span className="aq-micro rounded-full px-2.5 py-1 text-tenue ring-1 ring-inset ring-sutil">
            Inactivo
          </span>
        ) : null}
      </div>
    </Link>
  )
}
