import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { correccionDesde, Mostrador } from '@/components/ventas/mostrador'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/app/(app)/modulos/ventas/actions', () => ({
  corregirVentaAction: vi.fn(),
  registrarVentaAction: vi.fn(),
}))

/**
 * El modal de corrección — RN-VEN-16 fecha corregible.
 *
 * ── Lo que verifica este archivo ────────────────────────────────────────────
 *
 * Que el `<input name="ocurrioEn">` se renderiza SIEMPRE (antes solo en el
 * alta), pre-cargado con la fecha original en formato AAAA-MM-DD, y que al
 * cambiarla el value nuevo es lo que el form manda al Server Action.
 *
 * ── Por qué este archivo y no el de acciones ───────────────────────────────
 *
 * El archivo `ventas-correccion-anulacion-cobro.test.ts` prueba el Server
 * Action — sin DOM, solo `formData` adentro, body que sale afuera. Este prueba
 * el COMPONENTE — necesita `render()` y `@testing-library/react`, así que vive
 * en su propio `.tsx` para que el transformer lo parsee como JSX.
 */

const botellon: Producto = {
  id: 'p-1',
  codigo: 'BOT_20L',
  nombre: 'Recarga de botellón de 20 L',
  presentacion: 'botellon',
  precioResidencial: '10000.00',
  precioComercial: '9000.00',
  precioMinimo: '8000.00',
  activo: true,
} as Producto

const stock: ResumenDeStock[] = [{ productoId: 'p-1', vendible: 100 } as ResumenDeStock]

/*
 * Una venta registrada al mediodía de Bogotá del 15 de septiembre de 2026.
 * El `createdAt` está en ISO 8601 con offset fijo de Colombia (-05:00), y
 * `correccionDesde` la va a leer con `aaaaMmDdEnLaPlanta` para pre-cargar el
 * `<input name="ocurrioEn">`. La hora se ancla a mediodía para no depender
 * de la hora del proceso de test — UTC en el contenedor.
 */
const ventaOriginal: VentaDelListado = {
  id: 'ven-1',
  clienteId: null,
  clienteNombre: null,
  clienteDocumento: null,
  tipoClienteAlMomento: null,
  registradoPor: 'admin-1',
  registradoPorNombre: 'admin',
  medioDePago: 'efectivo',
  canal: 'mostrador',
  tipo: 'producto',
  estado: 'confirmada',
  total: '30000.00',
  codigoDescuentoId: null,
  requiereFacturaElectronica: false,
  createdAt: '2026-09-15T12:00:00-05:00',
  anuladaPor: null,
  anuladaEn: null,
  motivoAnulacion: null,
  corrigeAId: null,
  corregidaPorId: null,
  lineas: [
    {
      productoId: 'p-1',
      productoNombre: 'Recarga',
      cantidad: 3,
      precioFinal: '10000',
      precioManual: false,
    },
  ],
} as VentaDelListado

afterEach(() => {
  vi.clearAllMocks()
})

describe('el modal de corrección pre-carga la fecha', () => {
  it('el input de fecha tiene la fecha original como value', () => {
    const correccion = correccionDesde(ventaOriginal)

    render(<Mostrador productos={[botellon]} stock={stock} correccion={correccion} />)

    const input = screen.getByLabelText(/Cuándo fue la venta/i) as HTMLInputElement
    expect(input.value).toBe('2026-09-15')
  })

  it('el input tiene min y max: piso de 90 días y techo de hoy', () => {
    const correccion = correccionDesde(ventaOriginal)

    render(<Mostrador productos={[botellon]} stock={stock} correccion={correccion} />)

    const input = screen.getByLabelText(/Cuándo fue la venta/i) as HTMLInputElement
    /*
     * El techo es hoy — distinto del value porque la venta es de hace 4 días.
     * El piso es 90 días atrás, distinto del value y distinto del techo.
     */
    expect(input.max).not.toBe('')
    expect(input.max).not.toBe(input.value)
    expect(input.min).not.toBe('')
    expect(input.min).not.toBe(input.value)
    expect(input.min).not.toBe(input.max)
  })

  it('muestra el help text del override, no el del alta', () => {
    const correccion = correccionDesde(ventaOriginal)

    render(<Mostrador productos={[botellon]} stock={stock} correccion={correccion} />)

    expect(
      screen.getByText(/Esta venta corregida va a contar en el día que elija/i),
    ).toBeInTheDocument()
  })
})

describe('cambiar la fecha en el modal propaga el nuevo valor', () => {
  it('tipear un día distinto deja ese día en el input', async () => {
    const correccion = correccionDesde(ventaOriginal)

    render(<Mostrador productos={[botellon]} stock={stock} correccion={correccion} />)

    const input = screen.getByLabelText(/Cuándo fue la venta/i) as HTMLInputElement
    const usuario = userEvent.setup()

    await usuario.clear(input)
    await usuario.type(input, '2026-09-10')

    /*
     * El value del input es lo que el Server Action va a leer del formData —
     * `corregirVentaAction` lo toma con `formData.get('ocurrioEn')` y lo manda
     * en el body. Acá probamos solo el lado del form: que el cambio de input
     * se refleja en el value controlado. El body ya está cubierto por los
     * tests de `corregirVentaAction` en el otro archivo.
     */
    expect(input.value).toBe('2026-09-10')
  })
})
