import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  CrearProveedor,
  ListaDeProveedores,
  MarcarPagada,
  RegistrarCompra,
} from '@/components/proveedores/proveedores'
import type { InsumoListado, Proveedor } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/proveedores/actions', () => ({
  cambiarEstadoAction: vi.fn(async () => ({})),
  crearProveedorAction: vi.fn(async () => ({})),
  marcarPagadaAction: vi.fn(async () => ({})),
  registrarCompraAction: vi.fn(async () => ({})),
}))

vi.mock('sileo', () => ({ sileo: { success: vi.fn(), warning: vi.fn() } }))

/**
 * La pantalla de proveedores y compras — M9.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que una línea compre exactamente UNA cosa. Una que sea insumo y botellón a la
 * vez no se puede convertir en movimiento de inventario sin adivinar cuál, y el
 * servidor la rechaza — ofrecerla sería prometer algo que no se puede hacer.
 *
 * Que la fecha de vencimiento aparezca SOLO a crédito y obligatoria ahí
 * (RN-PRO-07). No se estima con un plazo por defecto: la dice el proveedor. Y
 * lo que se paga de contado no vence, así que el campo no tendría qué
 * significar.
 *
 * Y que a un proveedor desactivado no se le pueda comprar: la compra se rechaza
 * del lado del servidor, y ofrecerlo en el desplegable manda a cargar una
 * compra entera para nada.
 */

function proveedor(over: Partial<Proveedor> = {}): Proveedor {
  return {
    id: 'prv-1',
    nombre: 'Plásticos del Caribe',
    nit: null,
    contacto: null,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function insumo(over: Partial<InsumoListado> = {}): InsumoListado {
  return {
    id: 'ins-1',
    codigo: 'TAP',
    nombre: 'Tapas',
    unidad: 'unidad',
    minimo: 100,
    saldo: 540,
    equivalenciaPorKilo: '450',
    activo: true,
    bajoMinimo: false,
    ...over,
  }
}

/** El `<input name="lineas">` oculto es el payload real de la compra. */
function lineasQueViajan(container: HTMLElement): unknown[] {
  const campo = container.querySelector<HTMLInputElement>('input[name="lineas"]')!
  return JSON.parse(campo.value)
}

function valorOculto(container: HTMLElement, nombre: string): string {
  return container.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)!.value
}

describe('ListaDeProveedores', () => {
  it('sin proveedores explica qué es un proveedor, y qué no', () => {
    render(<ListaDeProveedores proveedores={[]} puedeEditar />)

    expect(screen.getByText(/Todavía no hay proveedores/)).toBeInTheDocument()
    // El agua no se compra: se produce en planta.
    expect(screen.getByText(/El agua\s+no/)).toBeInTheDocument()
  })

  it('muestra el NIT solo cuando lo tiene', () => {
    const { rerender } = render(
      <ListaDeProveedores proveedores={[proveedor({ nit: '900123456-1' })]} puedeEditar />,
    )
    expect(screen.getByText(/NIT 900123456-1/)).toBeInTheDocument()

    rerender(<ListaDeProveedores proveedores={[proveedor({ nit: null })]} puedeEditar />)
    expect(screen.queryByText(/NIT/)).not.toBeInTheDocument()
  })

  it('muestra el contacto solo cuando lo tiene', () => {
    render(<ListaDeProveedores proveedores={[proveedor({ contacto: '300 555 1234' })]} puedeEditar />)

    expect(screen.getByText('300 555 1234')).toBeInTheDocument()
  })

  it('marca los desactivados, y no marca los activos', () => {
    render(
      <ListaDeProveedores
        proveedores={[
          proveedor({ id: 'prv-1', nombre: 'Activo SA', activo: true }),
          proveedor({ id: 'prv-2', nombre: 'Inactivo SA', activo: false }),
        ]}
        puedeEditar
      />,
    )

    expect(screen.getAllByText('Desactivado')).toHaveLength(1)
  })

  /*
   * Ocultar el botón no es control de acceso (RN-ACC-02) — `api/` valida
   * igual—, pero ofrecerlo a quien no puede es mandarlo a recibir un 403.
   */
  it('sin permiso de editar no ofrece el botón de estado', () => {
    render(<ListaDeProveedores proveedores={[proveedor()]} puedeEditar={false} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('el botón dice desactivar cuando está activo', () => {
    render(<ListaDeProveedores proveedores={[proveedor({ activo: true })]} puedeEditar />)

    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
  })

  /*
   * Reactivar está a un clic porque el caso real es «le volvimos a comprar». Sin
   * eso, el camino que se encuentra es crear un duplicado con el mismo NIT, y el
   * historial de compras queda partido en dos.
   */
  it('el botón dice volver a activar cuando está desactivado', () => {
    render(<ListaDeProveedores proveedores={[proveedor({ activo: false })]} puedeEditar />)

    expect(screen.getByRole('button', { name: 'Volver a activar' })).toBeInTheDocument()
  })

  it('el campo oculto manda el estado CONTRARIO al actual: es un interruptor', () => {
    const { container } = render(
      <ListaDeProveedores proveedores={[proveedor({ activo: true })]} puedeEditar />,
    )

    expect(valorOculto(container, 'activo')).toBe('no')
    expect(valorOculto(container, 'proveedorId')).toBe('prv-1')
  })

  it('y al revés cuando está desactivado', () => {
    const { container } = render(
      <ListaDeProveedores proveedores={[proveedor({ activo: false })]} puedeEditar />,
    )

    expect(valorOculto(container, 'activo')).toBe('si')
  })
})

describe('CrearProveedor', () => {
  /*
   * El NIT es opcional a propósito: un proveedor puede ser el señor que trae
   * las tapas en su camioneta. Exigirlo llevaría a inventar uno.
   */
  it('solo el nombre es obligatorio', () => {
    render(<CrearProveedor />)

    expect(screen.getByRole('textbox', { name: /Nombre/ })).toBeRequired()
    expect(screen.getByRole('textbox', { name: /NIT/ })).not.toBeRequired()
    expect(screen.getByRole('textbox', { name: /Contacto/ })).not.toBeRequired()
  })

  it('dice cuáles son opcionales, sin que haya que probar', () => {
    render(<CrearProveedor />)

    expect(screen.getByText(/El NIT y el contacto se cargan si se tienen/)).toBeInTheDocument()
  })
})

/**
 * Registrar una compra.
 *
 * Arranca eligiendo QUÉ llegó, y recién ahí muestra los campos que
 * corresponden.
 */
describe('RegistrarCompra — una línea compra una sola cosa', () => {
  function pintar(over: { proveedores?: Proveedor[]; insumos?: InsumoListado[] } = {}) {
    return render(
      <RegistrarCompra
        proveedores={over.proveedores ?? [proveedor()]}
        insumos={over.insumos ?? [insumo()]}
      />,
    )
  }

  /*
   * La compra a un inactivo se rechaza del lado del servidor. Ofrecerlo acá
   * manda a cargar una compra entera para que rebote al final.
   */
  it('solo ofrece proveedores activos', () => {
    pintar({
      proveedores: [
        proveedor({ id: 'prv-1', nombre: 'Activo SA', activo: true }),
        proveedor({ id: 'prv-2', nombre: 'Inactivo SA', activo: false }),
      ],
    })

    expect(screen.getByRole('option', { name: 'Activo SA' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Inactivo SA' })).not.toBeInTheDocument()
  })

  it('arranca en insumo, que es lo que más se compra', () => {
    pintar()

    expect(screen.getByRole('combobox', { name: /Qué llegó/ })).toHaveValue('insumo')
    expect(screen.getByRole('combobox', { name: /Cuál/ })).toBeInTheDocument()
  })

  it.each([
    ['botellones', 'Botellones'],
    ['bases', 'Bases'],
  ])('comprando %s no pregunta cuál insumo', async (valor) => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Qué llegó/ }), valor)

    expect(screen.queryByRole('combobox', { name: /Cuál/ })).not.toBeInTheDocument()
  })

  /*
   * Las bolsas se compran al peso y se guardan por unidad (RN-INS-02). Los
   * botellones y las bases se cuentan de a uno: no hay kilos que convertir.
   */
  it('«Vino por kilo» solo existe para insumos', async () => {
    const usuario = userEvent.setup()
    pintar()

    expect(screen.getByRole('checkbox', { name: /Vino por kilo/ })).toBeInTheDocument()

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Qué llegó/ }), 'bases')

    expect(screen.queryByRole('checkbox', { name: /Vino por kilo/ })).not.toBeInTheDocument()
  })

  it('el campo de cantidad cambia de nombre al tildar kilos', async () => {
    const usuario = userEvent.setup()
    pintar()

    expect(screen.getByRole('spinbutton', { name: /Cuántos/ })).toBeInTheDocument()

    await usuario.click(screen.getByRole('checkbox', { name: /Vino por kilo/ }))

    expect(screen.getByRole('spinbutton', { name: /Kilos/ })).toBeInTheDocument()
  })

  /*
   * Cambiar de insumo a bases con «por kilo» tildado dejaría una línea que pide
   * convertir bases por peso — que no significa nada.
   */
  it('cambiar qué se compró destilda los kilos', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(screen.getByRole('checkbox', { name: /Vino por kilo/ }))
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Qué llegó/ }), 'bases')
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Qué llegó/ }), 'insumo')

    expect(screen.getByRole('checkbox', { name: /Vino por kilo/ })).not.toBeChecked()
  })
})

describe('RegistrarCompra — el vencimiento solo a crédito (RN-PRO-07)', () => {
  async function elegirPago(medio: string) {
    const usuario = userEvent.setup()
    render(<RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />)
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Cómo se pagó/ }), medio)
  }

  it.each(['efectivo', 'transferencia'])('de %s no pregunta cuándo vence', async (medio) => {
    await elegirPago(medio)

    expect(screen.queryByLabelText(/Vence el/)).not.toBeInTheDocument()
  })

  it('a crédito lo pregunta, y es obligatorio', async () => {
    await elegirPago('credito')

    expect(screen.getByLabelText(/Vence el/)).toBeRequired()
  })

  it('a crédito avisa que va a aparecer en vencidas', async () => {
    await elegirPago('credito')

    expect(screen.getByText(/aviso de vencidas/)).toBeInTheDocument()
  })

  it('de contado no muestra esa advertencia', async () => {
    await elegirPago('efectivo')

    expect(screen.queryByText(/aviso de vencidas/)).not.toBeInTheDocument()
  })
})

/**
 * El `<input name="lineas">` oculto es lo que realmente viaja.
 *
 * Una compra a medio llenar manda la lista VACÍA a propósito: así el servidor
 * la rechaza por lo que es —una compra sin líneas— en vez de recibir una línea
 * con un cero adentro.
 */
describe('RegistrarCompra — lo que viaja en el campo oculto', () => {
  async function llenar(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Proveedor/ }), 'prv-1')
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Cuál/ }), 'ins-1')
    await usuario.type(screen.getByRole('spinbutton', { name: /Cuántos/ }), '10')
    await usuario.type(screen.getByRole('textbox', { name: /Costo por unidad/ }), '18000')
  }

  it('incompleta manda la lista vacía y el botón bloqueado', () => {
    const { container } = render(
      <RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />,
    )

    expect(lineasQueViajan(container)).toEqual([])
    expect(screen.getByRole('button', { name: /Registrar la compra/ })).toBeDisabled()
  })

  it('completa manda la línea y habilita el botón', async () => {
    const usuario = userEvent.setup()
    const { container } = render(
      <RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />,
    )

    await llenar(usuario)

    expect(lineasQueViajan(container)).toEqual([
      { insumoId: 'ins-1', cantidad: 10, costoUnitario: '18000' },
    ])
    expect(screen.getByRole('button', { name: /Registrar la compra/ })).toBeEnabled()
  })

  it('sin elegir el insumo la línea no viaja, aunque haya cantidad y costo', async () => {
    const usuario = userEvent.setup()
    const { container } = render(
      <RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />,
    )

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Proveedor/ }), 'prv-1')
    await usuario.type(screen.getByRole('spinbutton', { name: /Cuántos/ }), '10')
    await usuario.type(screen.getByRole('textbox', { name: /Costo por unidad/ }), '18000')

    expect(lineasQueViajan(container)).toEqual([])
  })

  /*
   * Los kilos viajan ADEMÁS de la cantidad, no en su lugar: el servidor
   * convierte con la equivalencia y deja los kilos, la equivalencia usada y las
   * unidades en el movimiento. Sin eso, un descuadre sería imposible de
   * reconstruir.
   */
  it('por kilo manda los kilos junto a la cantidad', async () => {
    const usuario = userEvent.setup()
    const { container } = render(
      <RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />,
    )

    await llenar(usuario)
    await usuario.click(screen.getByRole('checkbox', { name: /Vino por kilo/ }))

    expect(lineasQueViajan(container)).toEqual([
      { insumoId: 'ins-1', cantidad: 10, kilos: 10, costoUnitario: '18000' },
    ])
  })

  it('comprando bases la línea no lleva insumoId', async () => {
    const usuario = userEvent.setup()
    const { container } = render(
      <RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />,
    )

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Proveedor/ }), 'prv-1')
    await usuario.selectOptions(screen.getByRole('combobox', { name: /Qué llegó/ }), 'bases')
    await usuario.type(screen.getByRole('spinbutton', { name: /Cuántos/ }), '20')
    await usuario.type(screen.getByRole('textbox', { name: /Costo por unidad/ }), '35000')

    const [linea] = lineasQueViajan(container) as Record<string, unknown>[]
    expect(linea).not.toHaveProperty('insumoId')
    expect(linea).toMatchObject({ bases: 20, cantidad: 20, costoUnitario: '35000' })
  })

  it('el medio de pago también viaja en su campo oculto', async () => {
    const usuario = userEvent.setup()
    const { container } = render(
      <RegistrarCompra proveedores={[proveedor()]} insumos={[insumo()]} />,
    )

    await usuario.selectOptions(screen.getByRole('combobox', { name: /Cómo se pagó/ }), 'credito')

    expect(valorOculto(container, 'medioDePago')).toBe('credito')
  })
})

describe('MarcarPagada', () => {
  it('manda la compra que se está pagando', () => {
    const { container } = render(<MarcarPagada compraId="com-1" />)

    expect(valorOculto(container, 'compraId')).toBe('com-1')
  })

  it('el botón habla como habla quien cobra: «ya se pagó»', () => {
    render(<MarcarPagada compraId="com-1" />)

    expect(screen.getByRole('button', { name: 'Ya se pagó' })).toBeInTheDocument()
  })
})
