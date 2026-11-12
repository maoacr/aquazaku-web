import { Banknote, Landmark, Wallet } from 'lucide-react'
import type { CuentaConSaldo } from '@/lib/api-types'
import { aCentavos, aMonto, pesos } from '@/lib/plata'

/**
 * Los saldos — lo primero que se mira al abrir la pantalla.
 *
 * ── Por qué el total va arriba y no al final ────────────────────────────────
 *
 * La pregunta que trae a alguien acá es «¿cuánta plata tengo?». El desglose por
 * cuenta contesta «¿dónde está?», que es la segunda. Un total al pie obliga a
 * recorrer las cuentas para encontrar lo que se vino a ver.
 *
 * ── El total se suma en CENTAVOS ────────────────────────────────────────────
 *
 * Los montos llegan como strings (`numeric(12,2)` de Postgres). Sumarlos con
 * `Number` acumula error de coma flotante: cuatro cuentas ya pueden dar un peso
 * de diferencia contra la suma que hace `api/`, y entonces la pantalla y la base
 * discrepan sobre cuánta plata hay. Es el mismo criterio que `aCentavos` en los
 * dos repos.
 */
export function Saldos({ cuentas }: { cuentas: CuentaConSaldo[] }) {
  const totalCentavos = cuentas.reduce((t, c) => t + aCentavos(c.saldo), 0)
  const activas = cuentas.filter((c) => c.activa)

  return (
    <section className="grid gap-3">
      <article className="aq-tarjeta grid gap-1 p-5">
        <h2 className="aq-micro text-tenue">Plata disponible</h2>
        <p className="aq-cifra text-3xl font-semibold text-principal">
          {pesos(aMonto(totalCentavos))}
        </p>
        <p className="text-[13px] text-tenue">
          {activas.length === 1 ? 'en 1 cuenta' : `repartida en ${activas.length} cuentas`}
        </p>
      </article>

      {/*
        Base de UNA columna y `min-width` en el breakpoint, no `auto-fit`: en un
        teléfono `auto-fit` con un mínimo de 16rem deja una columna igual, pero
        el CSS no dice que eso sea lo buscado. Mobile-first se declara.
      */}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activas.map((cuenta) => (
          <li key={cuenta.id}>
            <TarjetaDeCuenta cuenta={cuenta} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const ICONO = {
  caja_menor: Wallet,
  caja_mayor: Banknote,
  banco: Landmark,
} as const

function TarjetaDeCuenta({ cuenta }: { cuenta: CuentaConSaldo }) {
  const Icono = ICONO[cuenta.tipo]
  const enCero = aCentavos(cuenta.saldo) === 0

  return (
    <article className="aq-tarjeta grid h-full gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-semibold text-principal">{cuenta.nombre}</p>
        <Icono aria-hidden className="size-4 shrink-0 text-tenue" />
      </div>

      <p className="aq-cifra text-xl font-semibold text-principal">{pesos(cuenta.saldo)}</p>

      {cuenta.banco ? (
        <p className="text-[13px] text-secundario">
          {cuenta.banco} · {cuenta.tipoDeCuentaBancaria === 'ahorros' ? 'Ahorros' : 'Corriente'}{' '}
          <span className="aq-cifra text-tenue">{cuenta.numero}</span>
        </p>
      ) : null}

      {/*
        ── Lo accionable va donde quedó el hueco ───────────────────────────────

        Una cuenta en cero puede ser dos cosas muy distintas: se gastó todo, o
        nunca se cargó lo que había. La segunda es la más probable el primer día,
        y deja la pantalla inservible —no se puede registrar un gasto sin saldo—
        sin decir por qué.

        El aviso vive EN la tarjeta de la cuenta, que es donde está el hueco. En
        una nota al pie de la pantalla pesaría lo mismo que un dato más.
      */}
      {enCero ? (
        <p className="text-[13px] text-tenue">
          En cero. Si había plata acá, cárguele el saldo inicial abajo para poder
          registrar gastos.
        </p>
      ) : null}
    </article>
  )
}
