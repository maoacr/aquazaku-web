'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'
import { pesos } from '@/lib/plata'

/**
 * Gastos y tesorería — M17.
 *
 * Todo pasa por `apiServerFetchRaw`: el browser nunca le habla a `api/`
 * (ADR-0002), así que estas acciones corren en el servidor y reenvían la cookie.
 *
 * Ninguna valida reglas de negocio. Que el saldo alcance, que el saldo inicial
 * no se cargue dos veces y que la fecha no sea futura lo decide `api/` — copiar
 * esas reglas acá daría dos jueces que pueden discrepar, y el que manda es el
 * que escribe en la base (RN-ACC-02).
 */

async function mensajeDeError(res: Response, generico: string): Promise<string> {
  try {
    const cuerpo = (await res.json()) as { mensaje?: string; error?: string }
    return cuerpo.mensaje ?? cuerpo.error ?? generico
  } catch {
    return generico
  }
}

async function enviar(
  url: string,
  cuerpo: object,
  generico: string,
  alSalirBien: (r: Record<string, unknown>) => string,
  metodo = 'POST',
): Promise<EstadoDeFormulario> {
  const res = await apiServerFetchRaw(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })

  if (!res.ok) return { error: await mensajeDeError(res, generico) }

  const datos = (await res.json()) as Record<string, unknown>
  revalidatePath('/modulos/gastos')

  return exito(alSalirBien(datos))
}

/** Los campos que comparten las tres puertas del libro. */
function comunes(formData: FormData) {
  return {
    cuentaId: String(formData.get('cuentaId') ?? ''),
    monto: String(formData.get('monto') ?? ''),
    ocurridoEl: String(formData.get('ocurridoEl') ?? ''),
    concepto: String(formData.get('concepto') ?? ''),
  }
}

/**
 * Registrar un gasto — la razón de ser del módulo.
 *
 * `proveedorId`, `beneficiario` y `numeroDeFactura` solo viajan si los
 * cargaron: son opcionales a propósito. Exigir proveedor llevaría a dar de alta
 * «EPM» para pagar la luz, y exigir factura dejaría sin registrar el gasto que
 * no la tiene — que es exactamente cuando la caja descuadra.
 */
export async function registrarGastoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const proveedorId = String(formData.get('proveedorId') ?? '').trim()
  const beneficiario = String(formData.get('beneficiario') ?? '').trim()
  const numeroDeFactura = String(formData.get('numeroDeFactura') ?? '').trim()

  return enviar(
    '/gastos/egresos',
    {
      ...comunes(formData),
      tipoDeEgreso: String(formData.get('tipoDeEgreso') ?? ''),
      ...(proveedorId && { proveedorId }),
      ...(beneficiario && { beneficiario }),
      ...(numeroDeFactura && { numeroDeFactura }),
    },
    'No pudimos registrar el gasto.',
    (r) => `Gasto de ${pesos(String(r.monto))} registrado.`,
  )
}

export async function registrarIngresoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  return enviar(
    '/gastos/ingresos',
    { ...comunes(formData), tipoDeIngreso: String(formData.get('tipoDeIngreso') ?? '') },
    'No pudimos registrar el ingreso.',
    (r) => `Ingreso de ${pesos(String(r.monto))} registrado.`,
  )
}

/**
 * El saldo inicial — la plata que ya había cuando la cuenta entró al sistema.
 *
 * Una sola vez por cuenta (RN-GAS-04): cargarlo dos veces es la misma plata
 * contada dos veces. `api/` lo rechaza y explica por qué.
 */
export async function registrarSaldoInicialAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  return enviar(
    '/gastos/saldo-inicial',
    comunes(formData),
    'No pudimos cargar el saldo inicial.',
    (r) => `Saldo inicial de ${pesos(String(r.monto))} cargado.`,
  )
}

/**
 * Anular un movimiento — no se edita, se anula con motivo (RN-GAS-05).
 *
 * El motivo es obligatorio y de al menos 10 caracteres porque es lo que va a
 * explicar el descuadre dentro de tres meses.
 */
export async function anularMovimientoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('movimientoId') ?? '')

  return enviar(
    `/gastos/movimientos/${id}/anulacion`,
    { motivo: String(formData.get('motivo') ?? '') },
    'No pudimos anular el movimiento.',
    (r) => `Movimiento de ${pesos(String(r.monto))} anulado.`,
  )
}

/** Dar de alta una cuenta bancaria. Las dos cajas ya existen y son únicas. */
export async function crearCuentaBancariaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  return enviar(
    '/cuentas',
    {
      nombre: String(formData.get('nombre') ?? ''),
      banco: String(formData.get('banco') ?? ''),
      numero: String(formData.get('numero') ?? ''),
      tipoDeCuentaBancaria: String(formData.get('tipoDeCuentaBancaria') ?? 'ahorros'),
    },
    'No pudimos crear la cuenta.',
    (r) => `${r.nombre} quedó cargada.`,
  )
}

export async function cambiarEstadoDeCuentaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('cuentaId') ?? '')
  const activa = formData.get('activa') === 'si'

  return enviar(
    `/cuentas/${id}/estado`,
    { activa },
    'No pudimos cambiar el estado de la cuenta.',
    (r) => `${r.nombre} quedó ${activa ? 'activa' : 'inactiva'}.`,
    'PATCH',
  )
}

export type { EstadoDeFormulario }
