import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UltimasVentas } from '@/components/ventas/ultimas-ventas'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/ventas/actions', () => ({
  registrarVentaAction: vi.fn(),
  corregirVentaAction: vi.fn(),
  anularVentaAction: vi.fn(),
}))

/**
 * Corregir una venta desde la lista — RN-VEN-16.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que el modal se abra **con la venta adentro**. Es todo el punto: una
 * corrección que arranca con el carrito vacío no es corregir, es volver a
 * cargar la venta de cero — y quien tenía que arreglar un tipeo termina
 * tecleando los otros cuatro productos de memoria, que es exactamente cómo se
 * introduce el error siguiente.
 *
 * Por eso los asserts miran el campo oculto `items` y no lo que se dibuja: es
 * lo que de verdad viaja a `api/`.
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

const bolsas: Producto = {
  id: 'p-2',
  codigo: 'BOLSA_600',
  nombre: 'Paca de bolsas de 600 ml',
  presentacion: 'paca',
  precioResidencial: '7000.00',
  precioComercial: '6500.00',
  precioMinimo: '5000.00',
  activo: true,
} as Producto

const stock: ResumenDeStock[] = [
  { productoId: 'p-1', vendible: 100 } as ResumenDeStock,
  { productoId: 'p-2', vendible: 40 } as ResumenDeStock,
]

function venta(sobrescribe: Partial<VentaDelListado> = {}): VentaDelListado {
  return {
    id: 'v1',
    clienteId: 'c1',
    clienteNombre: 'Yeimy Poveda',
    clienteDocumento: 'CC 79.123.456',
    tipoClienteAlMomento: 'residencial',
    medioDePago: 'efectivo',
    canal: 'mostrador',
    tipo: 'producto',
    estado: 'confirmada',
    total: '30000.00',
    codigoDescuentoId: null,
    requiereFacturaElectronica: false,
    registradoPor: 'u1',
    registradoPorNombre: 'Marleny',
    createdAt: '2026-09-15T20:00:00.000Z',
    anuladaPor: null,
    anuladaEn: null,
    motivoAnulacion: null,
    corrigeAId: null,
    corregidaPorId: null,
    lineas: [
      {
        productoId: 'p-1',
        productoNombre: 'Recarga de botellón de 20 L',
        cantidad: 3,
        precioFinal: '10000.00',
        precioManual: false,
      },
    ],
    ...sobrescribe,
  }
}

const montar = (
  sobrescribe: Partial<VentaDelListado> = {},
  desde?: 'la-ficha-del-cliente',
) => {
  const { container } = render(
    <UltimasVentas
      ventas={[venta(sobrescribe)]}
      productos={[botellon, bolsas]}
      stock={stock}
      {...(desde && { desde })}
    />,
  )

  return {
    usuario: userEvent.setup(),
    container,
    /** Lo que de verdad viaja: el campo oculto que `api/` va a leer. */
    itemsQueViajan: () =>
      JSON.parse(
        (container.querySelector('input[name="items"]') as HTMLInputElement).value,
      ) as { productoId: string; cantidad: number; precioManual?: string }[],
  }
}

describe('el botón de corregir', () => {
  it('está en una venta confirmada', async () => {
    montar()
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeInTheDocument()
  })

  /** Una venta que ya salió de confirmada no se toca más: `api/` lo rechaza. */
  it('no está en una venta anulada', () => {
    montar({ estado: 'anulada', anuladaEn: '2026-09-15T21:00:00.000Z', motivoAnulacion: 'se arrepintió' })
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
  })

  it('tampoco en una que ya fue corregida', () => {
    montar({
      estado: 'corregida',
      anuladaEn: '2026-09-15T21:00:00.000Z',
      motivoAnulacion: 'se cargaron 2 y habían salido 5',
      corregidaPorId: 'v2',
    })
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
  })

  /**
   * Un recargo por daño no tiene productos que rehacer — RN-BAS-08. Anular sí.
   */
  it('no está en un recargo por daño, pero anular sí', () => {
    montar({ tipo: 'dano_base', lineas: [] })
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument()
  })
})

/**
 * ── Las acciones viven en las DOS pantallas ────────────────────────────────
 *
 * Una venta mal cargada se descubre más seguido en la ficha del cliente que en
 * la pantalla de Ventas: es ahí donde alguien mira la cuenta y dice «esto no lo
 * compró». Si los botones solo estuvieran del otro lado, quien ya tiene la
 * venta enfrente tendría que ir a buscarla entre las cien últimas del negocio
 * — y ahí es donde se corrige la equivocada.
 */
describe('desde la ficha del cliente', () => {
  it('también se puede corregir y anular', () => {
    montar({}, 'la-ficha-del-cliente')

    expect(screen.getByRole('button', { name: 'Corregir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument()
  })

  it('y el modal llega igual de precargado', async () => {
    const { usuario, itemsQueViajan } = montar({}, 'la-ficha-del-cliente')

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect(itemsQueViajan()).toEqual([{ productoId: 'p-1', cantidad: 3 }])
  })

  /**
   * Sin catálogo no hay acciones: es como se dibuja la lista para quien solo
   * puede LEER. `api/` le niega `/productos` a un `contador`, y la ausencia de
   * los datos es lo que apaga los botones — la matriz no se copia en la vista.
   */
  it('sin catálogo no aparece ninguna acción', () => {
    render(<UltimasVentas ventas={[venta()]} desde="la-ficha-del-cliente" />)

    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
  })
})

describe('el modal abre con la venta adentro', () => {
  it('el carrito llega precargado con lo que se vendió', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect(itemsQueViajan()).toEqual([{ productoId: 'p-1', cantidad: 3 }])
  })

  it('con el precio que alguien había escrito a mano — RN-VEN-15', async () => {
    const { usuario, itemsQueViajan } = montar({
      total: '11400.00',
      lineas: [
        {
          productoId: 'p-1',
          productoNombre: 'Recarga de botellón de 20 L',
          cantidad: 3,
          precioFinal: '3800.00',
          precioManual: true,
        },
      ],
    })

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect(itemsQueViajan()).toEqual([{ productoId: 'p-1', cantidad: 3, precioManual: '3800' }])
  })

  it('y con el cliente que tenía, para no perderlo al abrir', async () => {
    const { usuario, container } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    const dialogo = within(container.querySelector('dialog') as HTMLElement)
    expect(dialogo.getByText('CC 79.123.456')).toBeInTheDocument()
    expect(
      (container.querySelector('input[name="clienteId"]') as HTMLInputElement).value,
    ).toBe('c1')
  })

  it('lleva el id de la venta que reemplaza', async () => {
    const { usuario, container } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect((container.querySelector('input[name="ventaId"]') as HTMLInputElement).value).toBe('v1')
  })

  /**
   * ── La fecha NO se ofrece — RN-VEN-16 ────────────────────────────────────
   *
   * La venta nueva hereda el instante exacto de la que reemplaza. Un campo de
   * fecha acá diría que se puede mover la venta de día, y arreglar un tipeo
   * pasaría a poder reescribir el reporte de un mes ya emitido.
   */
  it('no ofrece cambiar la fecha', async () => {
    const { usuario, container } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect(container.querySelector('input[name="ocurrioEn"]')).toBeNull()
  })
})

/**
 * ── El motivo tiene que estar ARRIBA, y el botón tiene que decir por qué ────
 *
 * Los dos assertions de acá salen de un bug real. La primera versión ponía el
 * motivo abajo, pegado al botón, con el argumento de que es «lo último que se
 * escribe». Medido en el navegador: el campo nacía a 1101px con el modal
 * cortando en 1082 —debajo del fold— y el botón 261px más abajo, apagado y sin
 * una sola línea que dijera qué lo apagaba.
 *
 * Quien abría la corrección veía un «Guardar» gris y ninguna explicación. No
 * hay forma de distinguir «le falta algo» de «esto está roto».
 *
 * jsdom no hace layout, así que ningún test podía ver los 1101px. Lo que SÍ se
 * puede fijar acá es el orden en el DOM y la existencia del aviso, que es lo
 * que falló.
 */
describe('lo que hacía que el botón pareciera roto', () => {
  it('el motivo va ANTES de los productos, no al final', async () => {
    const { usuario, container } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    const campos = container.querySelectorAll('textarea[name="motivo"], input[name="items"]')
    const motivo = container.querySelector('textarea[name="motivo"]') as HTMLElement
    const productos = screen.getByText('QUÉ SE LLEVA', { exact: false })

    expect(campos.length).toBeGreaterThan(0)
    // `compareDocumentPosition` devuelve FOLLOWING cuando el segundo va después.
    expect(motivo.compareDocumentPosition(productos)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('con el motivo vacío, el botón DICE qué le falta', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect(screen.getByRole('button', { name: 'Guardar la corrección' })).toBeDisabled()
    expect(screen.getByText(/Falta decir por qué se corrige/)).toBeInTheDocument()
  })

  it('y el aviso desaparece cuando el motivo alcanza', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))
    await usuario.click(screen.getByRole('textbox', { name: /Por qué se corrige/ }))
    await usuario.paste('se cargaron 2 y habían salido 5')

    expect(screen.queryByText(/Falta decir por qué se corrige/)).not.toBeInTheDocument()
  })
})

describe('el motivo no es opcional', () => {
  it('sin motivo no se puede guardar', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))

    expect(screen.getByRole('button', { name: 'Guardar la corrección' })).toBeDisabled()
  })

  it('con una explicación de verdad, sí', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))
    /*
     * `paste` y no `type`: el textarea es CONTROLADO, y con `type` el
     * round-trip de render normaliza solo — el test pasa aunque el valor no
     * llegue nunca al estado. Pegando, lo que se afirma es lo que de verdad
     * quedó.
     */
    await usuario.click(screen.getByRole('textbox', { name: /Por qué se corrige/ }))
    await usuario.paste('se cargaron 2 y habían salido 5')

    expect(screen.getByRole('button', { name: 'Guardar la corrección' })).toBeEnabled()
  })
})

/**
 * ── Corregida NO se lee igual que anulada ───────────────────────────────────
 *
 * Las dos dejaron de contar y las dos se dibujan apagadas. Pero una venta
 * corregida tiene una sucesora VIVA, y decir solo «Anulada» esconde que la
 * plata está unos centímetros más arriba en la misma lista.
 */
describe('la tarjeta de una venta corregida', () => {
  const corregida = {
    estado: 'corregida' as const,
    anuladaEn: '2026-09-15T21:00:00.000Z',
    motivoAnulacion: 'se cargaron 2 y habían salido 5',
    corregidaPorId: 'v2',
  }

  it('lleva su propio sello', () => {
    montar(corregida)
    expect(screen.getByText('Corregida')).toBeInTheDocument()
    expect(screen.queryByText('Anulada')).not.toBeInTheDocument()
  })

  it('dice que hay otra venta en su lugar', () => {
    montar(corregida)
    expect(screen.getByText(/La reemplazó otra venta/)).toBeInTheDocument()
  })

  it('y muestra por qué se corrigió', () => {
    montar(corregida)
    expect(screen.getByText('se cargaron 2 y habían salido 5')).toBeInTheDocument()
  })
})
