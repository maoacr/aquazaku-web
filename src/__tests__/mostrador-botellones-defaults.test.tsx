import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Mostrador } from '@/components/ventas/mostrador'
import type { Producto, ResumenDeStock } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/ventas/actions', () => ({
  registrarVentaAction: vi.fn(),
}))

/**
 * RN-VEN-17 — los dos campos de botellones siguen al carrito en el alta.
 *
 * El caso común del mostrador es el intercambio 1-a-1: el cliente trae tantos
 * vacíos como llenos se lleva. El formulario arranca con los dos números en
 * `0`, y al sumar la primera recarga de botellón tiene que pintar 1 y 1 — no
 * quedar en 0 hasta que el operador los corrija a mano. Si después sube a 5,
 * los dos suben solos. Si el operador edita uno, el sync se apaga.
 *
 * Es lo que el ojo del operador espera: agregar un ítem «llena» los campos
 * que describen ese ítem. Sin esto, la sección aparece vacía y se lee como
 * que hay que tipear de cero.
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
    container,
    agregarBotellon: () =>
      screen.getByRole('button', { name: /Agregar uno de Recarga/i }),
  }
}

const entregados = () => screen.getByLabelText(/Entregados/i) as HTMLInputElement
const recibidos = () => screen.getByLabelText(/Recibidos/i) as HTMLInputElement

describe('los defaults de los dos campos de botellones siguen al carrito', () => {
  it('al sumar la primera recarga, los dos campos pintan 1 y 1', async () => {
    const { usuario, agregarBotellon } = montar()

    /*
     * Antes de sumar no hay sección — `botellonesEnCarrito = 0`. La断言
     * también cubre que el `findByLabelText` NO falla con timeout, porque
     * la sección no existe todavía.
     */
    expect(screen.queryByLabelText(/Entregados/i)).toBeNull()
    expect(screen.queryByLabelText(/Recibidos/i)).toBeNull()

    await usuario.click(agregarBotellon())

    expect(entregados().value).toBe('1')
    expect(recibidos().value).toBe('1')
  })

  it('subir el carrito arrastra los dos números al nuevo total', async () => {
    const { usuario, agregarBotellon } = montar()

    await usuario.click(agregarBotellon())
    expect(entregados().value).toBe('1')

    /*
     * Cuatro clicks más: carrito pasa de 1 a 5. Los dos campos pintan 5 sin
     * que el operador los haya tocado.
     */
    for (let i = 0; i < 4; i++) await usuario.click(agregarBotellon())

    expect(entregados().value).toBe('5')
    expect(recibidos().value).toBe('5')
  })

  it('si el operador edita uno de los dos, los siguientes cambios del carrito ya no lo sobrescriben', async () => {
    const { usuario, agregarBotellon } = montar()

    await usuario.click(agregarBotellon())
    await usuario.click(agregarBotellon())
    expect(entregados().value).toBe('2')

    /*
     * El operador corrige manualmente: el cliente trae un vacío extra (3
     * devueltos en vez de 2). A partir de acá el sync se apaga.
     */
    await usuario.clear(recibidos())
    await usuario.type(recibidos(), '3')
    expect(recibidos().value).toBe('3')
    expect(entregados().value).toBe('2')

    /*
     * Sube el carrito a 4. El sync se apagó: `entregados` se queda en 2 (lo
     * que el operador tipeó al inicio), `recibidos` en 3. El cap en el
     * hidden input se aplica para que el server no reciba 2 > 4 (eso lo
     * cubre el test del propio componente, no este archivo).
     */
    await usuario.click(agregarBotellon())
    await usuario.click(agregarBotellon())
    expect(recibidos().value).toBe('3')
    expect(entregados().value).toBe('2')
  })
})

/**
 * Tocar uno congela los DOS — RN-VEN-17.
 *
 * ── El defecto que este bloque existe para impedir ──────────────────────────
 *
 * El flag de «el operador se hizo cargo» es UNO para los dos campos. Cuando los
 * defaults se sincronizaban con un `useEffect`, eso salía gratis: el efecto ya
 * había ESCRITO los dos valores en el estado, así que el campo intacto
 * conservaba el suyo.
 *
 * Al pasar a derivarlos durante el render —para sacar el `set-state-in-effect`
 * que React marca— el campo intacto se quedó con su estado inicial, que es
 * cero. Escribir 3 en «Recibidos» con dos botellones en el carrito dejaba
 * «Entregados» en 0: dos botellones que salen del parque y no quedan a cargo
 * de nadie.
 *
 * El caso de arriba lo atrapó en una dirección. Este cubre la otra, que es la
 * peligrosa: la que pierde lo que SALE.
 */
describe('tocar un campo no borra el default del otro', () => {
  it('escribir en «Recibidos» deja «Entregados» con lo que mostraba', async () => {
    const { usuario, agregarBotellon } = montar()

    await usuario.click(agregarBotellon())
    await usuario.click(agregarBotellon())
    expect(entregados().value).toBe('2')

    await usuario.clear(recibidos())
    await usuario.type(recibidos(), '3')

    expect(entregados().value).toBe('2')
  })

  it('escribir en «Entregados» deja «Recibidos» con lo que mostraba', async () => {
    const { usuario, agregarBotellon } = montar()

    await usuario.click(agregarBotellon())
    await usuario.click(agregarBotellon())
    expect(recibidos().value).toBe('2')

    await usuario.clear(entregados())
    await usuario.type(entregados(), '1')

    expect(recibidos().value).toBe('2')
  })

  /*
   * Y lo que viaja al servidor es eso mismo. El campo se ve bien y el oculto
   * manda otra cosa es el error que ningún test de pantalla atrapa.
   */
  it('lo congelado es también lo que viaja', async () => {
    const { usuario, agregarBotellon, container } = montar()

    await usuario.click(agregarBotellon())
    await usuario.click(agregarBotellon())
    await usuario.clear(recibidos())
    await usuario.type(recibidos(), '3')

    const oculto = (name: string) =>
      (container.querySelector(`input[name="${name}"]`) as HTMLInputElement).value

    expect(oculto('botellonesEntregados')).toBe('2')
    expect(oculto('botellonesRecibidos')).toBe('3')
  })
})
