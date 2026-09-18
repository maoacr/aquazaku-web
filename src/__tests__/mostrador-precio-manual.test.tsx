import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Mostrador } from '@/components/ventas/mostrador'
import type { Producto, ResumenDeStock } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/ventas/actions', () => ({
  registrarVentaAction: vi.fn(),
}))

/**
 * El precio escrito a mano en la card — RN-VEN-15.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que el número que viaja sea el que la persona quiso escribir, y no el que el
 * formato le hizo escribir.
 *
 * La card pinta «$10.000» con `toLocaleString('es-CO')`. Quien quiere poner tres
 * mil ochocientos escribe «3.800», porque es lo que tiene enfrente. Contra el
 * `^\d+(\.\d{1,2})?$` de `api/`, «3.5» PASA como $3,50 — y no falla: REGISTRA.
 * RN-VEN-02 prohíbe editar una venta confirmada, así que el error se descubre
 * cuando tres botellones sumaron $10,50 y ya no hay forma de corregirlo salvo
 * anular.
 *
 * Por eso el campo descarta todo lo que no sea dígito, y por eso estos tests
 * escriben con punto a propósito.
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

const montar = () => {
  const { container } = render(<Mostrador productos={[botellon]} stock={stock} />)

  return {
    usuario: userEvent.setup(),
    /** Lo que de verdad viaja: el campo oculto que `api/` va a leer. */
    itemsQueViajan: () =>
      JSON.parse(
        (container.querySelector('input[name="items"]') as HTMLInputElement).value,
      ) as { productoId: string; cantidad: number; precioManual?: string }[],
  }
}

const campoDePrecio = () => screen.getByLabelText(/Precio por unidad de Recarga/i)

/**
 * ── Por qué acá se PEGA y no se tipea ───────────────────────────────────────
 *
 * `userEvent.type` escribe carácter por carácter, y entre tecla y tecla el
 * `value` controlado vuelve a pasar por `Number().toLocaleString()`. Ese viaje
 * de ida y vuelta ya se come el punto solo, con filtro o sin él.
 *
 * O sea: tipear NO prueba el filtro. Se descubrió sacándolo y viendo que los
 * tests seguían verdes — un test que pasa por la razón equivocada es peor que
 * no tenerlo, porque ocupa el lugar del que sí habría avisado.
 *
 * Pegar entrega la cadena entera en un solo evento, que es lo que de verdad
 * ejercita el filtro. Y no es un caso rebuscado: quien carga ventas viejas está
 * copiando números de un cuaderno, de un WhatsApp o de una planilla.
 */
describe('el campo solo acepta pesos enteros', () => {
  const pegar = async (usuario: ReturnType<typeof userEvent.setup>, texto: string) => {
    await usuario.click(campoDePrecio())
    await usuario.paste(texto)
  }

  it('pegar «3.800» manda 3800, no «3.800»', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Recarga/i }))
    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await pegar(usuario, '3.800')

    expect(itemsQueViajan()[0]?.precioManual).toBe('3800')
  })

  /**
   * El caso que motivó toda la decisión.
   *
   * «3.5» contra el `^\d+(\.\d{1,2})?$` de `api/` es VÁLIDO: entra como $3,50
   * cuando la persona quiso $3.500. No rebota, no avisa: registra. Y RN-VEN-02
   * no deja corregir la venta después.
   */
  it('pegar «3.5» manda 35, nunca «3.5»', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Recarga/i }))
    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await pegar(usuario, '3.5')

    expect(itemsQueViajan()[0]?.precioManual).toBe('35')
  })

  it('pegar «$ 9.600 c/u» se queda con 9600', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Recarga/i }))
    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await pegar(usuario, '$ 9.600 c/u')

    expect(itemsQueViajan()[0]?.precioManual).toBe('9600')
  })

  it('tipear letras entre los dígitos tampoco las deja pasar', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Recarga/i }))
    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await usuario.type(campoDePrecio(), '38abc00')

    expect(itemsQueViajan()[0]?.precioManual).toBe('3800')
  })

  it('muestra el número con separador de miles mientras se escribe', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await usuario.type(campoDePrecio(), '3800')

    expect((campoDePrecio() as HTMLInputElement).value).toBe('3.800')
  })
})

describe('qué viaja y qué no', () => {
  it('sin la casilla tildada, el ítem va sin precio manual', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Recarga/i }))

    expect(itemsQueViajan()[0]).not.toHaveProperty('precioManual')
  })

  /**
   * Destildar tiene que BORRAR el número, no esconderlo. Un precio que sigue
   * viajando después de que alguien se arrepintió es peor que uno mal escrito:
   * nadie lo está mirando.
   */
  it('destildar la casilla saca el precio del envío', async () => {
    const { usuario, itemsQueViajan } = montar()

    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Recarga/i }))
    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await usuario.type(campoDePrecio(), '3800')
    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))

    expect(itemsQueViajan()[0]).not.toHaveProperty('precioManual')
  })
})

describe('la cuenta por cantidad se muestra hecha', () => {
  /**
   * El precio se escribe por unidad y se cobra por cantidad. Con tres botellones
   * en el mostrador esas dos cosas se confunden, y RN-VEN-02 no deja corregir la
   * venta después.
   */
  it('muestra el subtotal ya multiplicado dentro de la card', async () => {
    const { usuario } = montar()

    const agregar = screen.getByRole('button', { name: /Agregar uno de Recarga/i })
    await usuario.click(agregar)
    await usuario.click(agregar)
    await usuario.click(agregar)

    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await usuario.type(campoDePrecio(), '3800')

    const card = screen.getByRole('listitem')

    expect(within(card).getByText(/^\$11\.400$/)).toBeInTheDocument()
    expect(within(card).getByText(/^3$/)).toBeInTheDocument()
  })

  /**
   * El total de la venta también tiene que moverse.
   *
   * Es la pantalla que quien atiende mira antes de cobrar. Un total que sigue
   * diciendo $30.000 mientras las líneas dicen $3.800 es la clase de número que
   * se cobra sin leer las líneas.
   */
  it('el total estimado de la venta usa el precio escrito, no el de lista', async () => {
    const { usuario } = montar()

    const agregar = screen.getByRole('button', { name: /Agregar uno de Recarga/i })
    await usuario.click(agregar)
    await usuario.click(agregar)
    await usuario.click(agregar)

    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await usuario.type(campoDePrecio(), '3800')

    // 3 × 3.800 = 11.400, y NO 3 × 10.000 = 30.000.
    expect(screen.queryByText(/30\.000/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/11\.400/).length).toBeGreaterThan(1)
  })

  /**
   * La lista se sigue viendo al lado del campo: quien escribe un precio tiene
   * que poder ver contra qué lo escribe, sin destildar para espiar.
   */
  it('sigue mostrando el precio de lista mientras se escribe otro', async () => {
    const { usuario } = montar()

    await usuario.click(screen.getByLabelText(/Cobré otro precio/i))
    await usuario.type(campoDePrecio(), '3800')

    expect(screen.getByText(/la lista dice/i)).toBeInTheDocument()
    expect(screen.getByText(/^\$10\.000$/)).toBeInTheDocument()
  })
})
