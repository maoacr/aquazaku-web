import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RegistrarGasto } from '@/components/gastos/registrar-gasto'
import type { CuentaConSaldo, Proveedor } from '@/lib/api-types'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
/*
 * El mock devuelve un `EstadoDeFormulario`, no `undefined`.
 *
 * `useActionState` toma lo que devuelve la acción COMO el estado nuevo. Un
 * `vi.fn()` pelado devuelve `undefined` y el componente revienta en el hook del
 * aviso — un fallo del mock que se lee igual que un bug del formulario.
 */
vi.mock('@/app/(app)/modulos/gastos/actions', () => ({
  registrarGastoAction: vi.fn(async () => ({})),
}))

const { registrarGastoAction } = await import('@/app/(app)/modulos/gastos/actions')

/**
 * El modal de registrar un pago — M17.
 *
 * ── Por qué este archivo existe ─────────────────────────────────────────────
 *
 * `gastos-actions.test.ts` prueba el Server Action: formData adentro, cuerpo
 * JSON afuera. Eso deja un hueco entero — **nadie aprieta el botón**. Un
 * formulario puede tener los nueve campos correctos y no mandar ninguno porque
 * el botón quedó fuera del `<form>`, o porque un campo perdió su `name`.
 *
 * Ya pasó en este proyecto: nueve tests verdes sobre un flujo roto, y ninguno
 * llegaba a Guardar. Acá se abre el modal, se llena y se envía.
 */

const cajaMenor: CuentaConSaldo = {
  id: 'c-1',
  nombre: 'Caja menor',
  tipo: 'caja_menor',
  banco: null,
  numero: null,
  tipoDeCuentaBancaria: null,
  activa: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  saldo: '500000.00',
}

const enCero: CuentaConSaldo = { ...cajaMenor, id: 'c-2', nombre: 'Caja mayor', saldo: '0.00' }

const proveedor: Proveedor = {
  id: 'pr-1',
  nombre: 'Plásticos del Caribe',
  nit: null,
  contacto: null,
  activo: true,
  createdAt: '2026-11-01T12:00:00.000Z',
}

const HOY = '2026-11-12'

afterEach(() => {
  vi.clearAllMocks()
  vi.mocked(registrarGastoAction).mockImplementation(async () => ({}))
})

/** Lo que el formulario le pasó al Server Action, campo por campo. */
function loQueSeMando(): Record<string, string> {
  const fd = vi.mocked(registrarGastoAction).mock.calls[0]?.[1] as FormData

  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]))
}

describe('el botón de registrar un pago', () => {
  it('abre el modal, y antes de abrirlo el formulario no está', async () => {
    render(<RegistrarGasto cuentas={[cajaMenor]} proveedores={[proveedor]} hoy={HOY} />)

    expect(screen.queryByLabelText(/Qué se pagó/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Registrar pago/ }))

    expect(screen.getByLabelText(/Qué se pagó/)).toBeInTheDocument()
  })

  /*
   * Sin una cuenta con saldo no hay de dónde salga la plata. El botón se apaga
   * y se DICE por qué: un control deshabilitado sin explicación obliga a
   * adivinar qué falta.
   */
  it('se apaga sin cuentas con saldo, y dice qué falta', () => {
    render(<RegistrarGasto cuentas={[enCero]} proveedores={[]} hoy={HOY} />)

    expect(screen.getByRole('button', { name: /Registrar pago/ })).toBeDisabled()
    expect(screen.getByText(/Cargue el saldo inicial/)).toBeInTheDocument()
  })
})

describe('el formulario manda lo que se llenó', () => {
  async function abrirYLlenar() {
    render(<RegistrarGasto cuentas={[cajaMenor]} proveedores={[proveedor]} hoy={HOY} />)
    await userEvent.click(screen.getByRole('button', { name: /Registrar pago/ }))

    await userEvent.selectOptions(screen.getByLabelText(/Qué se pagó/), 'nomina')
    await userEvent.type(screen.getByLabelText(/^Cuánto/), '300000')
    await userEvent.type(screen.getByLabelText(/Concepto/), 'Quincena de noviembre')
  }

  it('los cinco campos obligatorios llegan al Server Action', async () => {
    await abrirYLlenar()

    await userEvent.click(screen.getByRole('button', { name: 'Registrar el pago' }))

    expect(loQueSeMando()).toMatchObject({
      tipoDeEgreso: 'nomina',
      monto: '300000',
      concepto: 'Quincena de noviembre',
      cuentaId: 'c-1',
      ocurridoEl: HOY,
    })
  })

  /*
   * Con una sola cuenta con saldo, viene elegida. Obligar a abrir un
   * desplegable de un solo elemento es un clic que no decide nada.
   */
  it('con una sola cuenta con saldo, viene elegida', async () => {
    render(<RegistrarGasto cuentas={[cajaMenor]} proveedores={[]} hoy={HOY} />)
    await userEvent.click(screen.getByRole('button', { name: /Registrar pago/ }))

    expect(screen.getByLabelText(/De qué cuenta sale/)).toHaveValue('c-1')
  })

  /** La fecha viene en hoy y se puede cambiar: el pago pudo ser el martes. */
  it('la fecha viene en hoy y es editable hacia atrás', async () => {
    await abrirYLlenar()

    const fecha = screen.getByLabelText(/Cuándo se pagó/)

    expect(fecha).toHaveValue(HOY)
    expect(fecha).toHaveAttribute('max', HOY)

    await userEvent.clear(fecha)
    await userEvent.type(fecha, '2026-11-05')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar el pago' }))

    expect(loQueSeMando().ocurridoEl).toBe('2026-11-05')
  })

  /*
   * Los catorce tipos tienen que estar TODOS elegibles. Agrupar con
   * `<optgroup>` es cosmético, pero un tipo que se caiga de los grupos
   * desaparece del desplegable sin que falle nada.
   */
  it('ofrece los diecisiete tipos, agrupados por categoría', async () => {
    const { GRUPOS_DE_EGRESO, TIPOS_DE_EGRESO } = await import('@/lib/gastos')

    render(<RegistrarGasto cuentas={[cajaMenor]} proveedores={[]} hoy={HOY} />)
    await userEvent.click(screen.getByRole('button', { name: /Registrar pago/ }))

    const opciones = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)

    for (const tipo of TIPOS_DE_EGRESO) {
      expect(opciones, `«${tipo}» no se puede elegir desde la pantalla`).toContain(tipo)
    }

    for (const grupo of GRUPOS_DE_EGRESO) {
      expect(screen.getByRole('group', { name: grupo.titulo })).toBeInTheDocument()
    }
  })

  /*
   * El modal se cierra SOLO con el éxito, y el éxito se reconoce por el token.
   * Con un error tiene que quedarse abierto: cerrarlo perdería lo escrito justo
   * cuando más duele, y el mensaje de qué corregir vive adentro.
   */
  it('se cierra cuando el pago quedó registrado', async () => {
    vi.mocked(registrarGastoAction).mockResolvedValue({ ok: 'Listo', token: 't-1' })
    await abrirYLlenar()

    await userEvent.click(screen.getByRole('button', { name: 'Registrar el pago' }))

    /*
     * `waitFor` y no una aserción seca: el cierre lo hace un efecto, y un
     * efecto corre DESPUÉS del commit. Sin esperar, el test pasa cuando la
     * máquina va lenta y falla cuando va rápida — o al revés.
     */
    await waitFor(() => {
      expect(screen.queryByLabelText(/Qué se pagó/)).not.toBeInTheDocument()
    })
  })

  it('con un error se queda abierto, y muestra qué pasó', async () => {
    vi.mocked(registrarGastoAction).mockResolvedValue({ error: 'Caja menor no tiene tanto' })
    await abrirYLlenar()

    await userEvent.click(screen.getByRole('button', { name: 'Registrar el pago' }))

    expect(screen.getByLabelText(/Qué se pagó/)).toBeInTheDocument()
    expect(screen.getByText('Caja menor no tiene tanto')).toBeInTheDocument()
  })

  it('el proveedor y la factura viajan cuando se cargan', async () => {
    await abrirYLlenar()

    await userEvent.selectOptions(screen.getByLabelText(/A quién/), 'pr-1')
    await userEvent.type(screen.getByLabelText(/Factura/), 'FV-1024')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar el pago' }))

    expect(loQueSeMando()).toMatchObject({ proveedorId: 'pr-1', numeroDeFactura: 'FV-1024' })
  })
})
