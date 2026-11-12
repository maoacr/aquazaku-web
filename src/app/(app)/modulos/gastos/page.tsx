import { Libro } from '@/components/gastos/libro'
import {
  CargarSaldoInicial,
  CrearCuentaBancaria,
  CuentasBancarias,
  RegistrarIngreso,
} from '@/components/gastos/otras-entradas'
import { PorTipo } from '@/components/gastos/por-tipo'
import { RegistrarGasto } from '@/components/gastos/registrar-gasto'
import { Saldos } from '@/components/gastos/saldos'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type {
  CuentaConSaldo,
  GastoPorTipo,
  MovimientoDeDinero,
  Proveedor,
} from '@/lib/api-types'
import { hoyEnLaPlanta } from '@/lib/hora-de-la-planta'
import { siPuedeVerlo } from '@/lib/permiso-opcional'

/**
 * Gastos y tesorería — M17.
 *
 * ── El orden de la pantalla es el de la frecuencia ──────────────────────────
 *
 * Primero los saldos, porque la pregunta que trae a alguien acá es «¿cuánta
 * plata tengo?». Después registrar un gasto, que es lo que pasa todos los días.
 * Después en qué se fue la plata del mes, y el libro. Al final lo que se hace de
 * vez en cuando: un ingreso, el saldo inicial, una cuenta bancaria nueva.
 *
 * ── Qué NO está acá ─────────────────────────────────────────────────────────
 *
 * Los insumos, los botellones y las bases: esos entran por Proveedores, que
 * mueve el inventario en la misma transacción. Registrarlos también como gasto
 * contaría el mes dos veces, y por eso el tipo de gasto directamente no existe
 * en `api/` (RN-GAS-07).
 */
export default async function GastosPage() {
  /*
   * `hoyEnLaPlanta()` se resuelve en el SERVIDOR y viaja como prop.
   *
   * Los formularios lo usan para el `max` del calendario. Calculado en el
   * browser usaría la zona del dispositivo: un teléfono al este de Colombia
   * ofrecería mañana, `api/` lo rechazaría con un 422, y el mensaje hablaría de
   * una fecha futura que en la pantalla se veía como hoy.
   */
  const hoy = hoyEnLaPlanta()

  const [cuentas, movimientos, porTipo, proveedores, saldosIniciales] = await Promise.all([
    apiServerFetch<CuentaConSaldo[]>('/cuentas?incluirInactivas=si'),
    apiServerFetch<MovimientoDeDinero[]>('/gastos/movimientos?incluirAnulados=si'),
    apiServerFetch<GastoPorTipo[]>('/gastos/por-tipo'),
    /*
     * Los proveedores alimentan el «a quién» del gasto, y son opcionales: si
     * alguien llega acá sin permiso de verlos, la pantalla se arma igual con el
     * campo de nombre libre. `siPuedeVerlo` se traga el 403 para no copiar acá
     * la matriz de permisos — la copia empezaría a mentir el día que cambie.
     */
    siPuedeVerlo(apiServerFetch<Proveedor[]>('/proveedores')),
    /*
     * Qué cuentas ya tienen su saldo inicial.
     *
     * Sale del libro filtrado por tipo, no de un endpoint nuevo: el dato ya
     * está y un endpoint más sería una segunda forma de preguntar lo mismo. No
     * se deduce de «el saldo es cero»: una cuenta puede tenerlo cargado y haber
     * quedado en cero después de gastar todo.
     */
    apiServerFetch<MovimientoDeDinero[]>('/gastos/movimientos?tipo=saldo_inicial'),
  ])

  const conSaldoInicial = new Set(saldosIniciales.map((m) => m.cuentaId))
  const sinSaldoInicial = cuentas.filter((c) => !conSaldoInicial.has(c.id)).map((c) => c.id)

  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="aq-titulo-pantalla text-principal">Gastos</h1>
        <p className="text-[15px] text-secundario">
          Dónde está la plata del negocio y en qué se va. Todo peso que entra o sale queda en el
          libro, y el saldo de cada cuenta es la suma de esas filas.
        </p>
      </header>

      {/*
        El botón de registrar va PEGADO a los saldos, no en una tarjeta aparte:
        la secuencia real es mirar cuánto hay y después pagar. Separarlos con una
        tarjeta de por medio rompe ese gesto.
      */}
      <section className="grid gap-3">
        <Saldos cuentas={cuentas} />
        <RegistrarGasto cuentas={cuentas} proveedores={proveedores ?? []} hoy={hoy} />
      </section>

      <section className="aq-tarjeta grid gap-3 p-5">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">En qué se fue la plata este mes</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Desde el primero del mes hasta hoy, por la fecha en que se pagó. Los anulados no
            cuentan: nunca movieron plata.
          </p>
        </div>

        <PorTipo gastos={porTipo} />
      </section>

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">
          {movimientos.length === 1 ? '1 movimiento' : `${movimientos.length} movimientos`}
        </h2>

        <Libro movimientos={movimientos} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>

      <RegistrarIngreso cuentas={cuentas} hoy={hoy} />

      <CargarSaldoInicial cuentas={cuentas} sinSaldoInicial={sinSaldoInicial} hoy={hoy} />

      <CuentasBancarias cuentas={cuentas} />

      <CrearCuentaBancaria />
    </div>
  )
}
