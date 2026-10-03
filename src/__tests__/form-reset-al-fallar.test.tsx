import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useActionState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SelectorDeDireccion } from '@/components/retornables/entrega-de-base'
import { Mostrador } from '@/components/ventas/mostrador'
import { direccionesDeClienteAction } from '@/app/(app)/modulos/clientes/actions'
import type { ClienteElegido, Direccion, Producto, ResumenDeStock } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  direccionesDeClienteAction: vi.fn(),
}))

vi.mock('@/app/(app)/modulos/ventas/actions', () => ({
  registrarVentaAction: vi.fn(),
  corregirVentaAction: vi.fn(),
}))

/*
 * Una PACA y no un botellón: agregar un botellón enciende el despacho de
 * retornables, que exige cliente y apaga «Cobrar». Acá lo que se mide es dónde
 * cae el error, no la regla de los botellones.
 */
const botellon = {
  id: 'p-1',
  codigo: 'PACA_600',
  nombre: 'Paca de 600 ml',
  presentacion: 'paca',
  precioResidencial: '10000.00',
  precioComercial: '9000.00',
  precioMinimo: '8000.00',
  activo: true,
} as Producto

const stock = [{ productoId: 'p-1', vendible: 100 }] as ResumenDeStock[]

/**
 * Lo que una venta rechazada le hace a los campos NO controlados.
 *
 * ── El reporte ──────────────────────────────────────────────────────────────
 *
 * «Si la venta no se puede realizar y aparece un mensaje de error, los valores
 * de todos los select cambian y hay que volverlos a escoger».
 *
 * ── Por qué este archivo existe antes del arreglo ───────────────────────────
 *
 * Para separar la causa real de la causa supuesta. React 19 resetea el
 * formulario cuando una acción termina, y NO distingue el éxito del error: los
 * campos manejados por estado se repintan desde el estado y sobreviven, los no
 * controlados vuelven al default. Si el reset es eso, se ve acá; si es otra
 * cosa, este test pasa y hay que seguir buscando.
 *
 * La consecuencia en la planta no es cosmética. RN-VEN-02 prohíbe editar una
 * venta confirmada: una dirección que volvió sola a la primera opción manda el
 * botellón a otra casa, y eso solo se arregla anulando.
 */

const cliente: ClienteElegido = { id: 'cli-1', nombre: 'Rosa Padilla' } as ClienteElegido

const direcciones: Direccion[] = [
  { id: 'dir-1', etiqueta: 'Casa', direccion: 'Calle 1 # 2-3' } as Direccion,
  { id: 'dir-2', etiqueta: 'Local', direccion: 'Carrera 9 # 8-7' } as Direccion,
]

/**
 * El ancestro importa: el selector solo se resetea DENTRO de un formulario con
 * `action`. Montarlo suelto mediría otra cosa — un `<select>` que nadie somete.
 */
function FormularioQueFalla({ alEnviar }: { alEnviar: () => void }) {
  const [estado, accion] = useActionState<{ error?: string }, FormData>(
    async (_previo, formData) => {
      alEnviar()
      /* La acción real cruza la red. Sin el await esto no mide lo que pasa. */
      await Promise.resolve()
      /* Lo que devuelve `registrarVentaAction` cuando `api/` rechaza. */
      return { error: `No se pudo: la dirección que viajó fue ${formData.get('direccionId')}` }
    },
    {},
  )

  return (
    <form action={accion}>
      <p>{estado.error}</p>
      <SelectorDeDireccion cliente={cliente} name="direccionId" />
      <button type="submit">Registrar la venta</button>
    </form>
  )
}

describe('una venta rechazada no debe borrar lo que ya se eligió', () => {
  it('el select de dirección conserva la opción elegida después del error', async () => {
    vi.mocked(direccionesDeClienteAction).mockResolvedValue(direcciones)

    const usuario = userEvent.setup()
    const enviado = vi.fn()

    render(<FormularioQueFalla alEnviar={enviado} />)

    const select = await waitFor(() => {
      const s = screen.getByRole('combobox', { name: /dirección/i }) as HTMLSelectElement
      expect(s.options.length).toBeGreaterThan(1)
      return s
    })

    /*
     * Se elige la SEGUNDA a propósito. Con la primera, un reset al default es
     * indistinguible de no haber reseteado nada — el test pasaría por la razón
     * equivocada.
     */
    await usuario.selectOptions(select, 'dir-2')
    expect(select.value).toBe('dir-2')

    await usuario.click(screen.getByRole('button', { name: /registrar la venta/i }))

    await waitFor(() => expect(enviado).toHaveBeenCalled())
    expect(await screen.findByText(/No se pudo/)).toBeInTheDocument()

    /* Lo que de verdad viajó, para saber si el error es previo o posterior al envío. */
    expect(screen.getByText(/la dirección que viajó fue dir-2/)).toBeInTheDocument()

    /* Y la queja: después del error, ¿sigue elegida la que la persona eligió? */
    expect((screen.getByRole('combobox', { name: /dirección/i }) as HTMLSelectElement).value).toBe(
      'dir-2',
    )
  })
})

/**
 * Dónde aparece el error de una venta rechazada.
 *
 * ── La queja ────────────────────────────────────────────────────────────────
 *
 * «El mensaje de error no se ve porque aparece en la parte superior del form y
 * el usuario no ve el error hasta que hace scroll».
 *
 * ── Por qué se mide el ORDEN y no la posición ───────────────────────────────
 *
 * jsdom no hace layout: acá todo mide cero y no hay scroll que comprobar. Lo
 * que sí determina dónde cae el mensaje en una pantalla real es su lugar en el
 * documento, y eso es lo que se fija. La comprobación de que de verdad entra en
 * el viewport es del navegador, no de este archivo.
 */
describe('el error de una venta rechazada aparece donde está el ojo', () => {
  it('el mensaje es el elemento inmediatamente anterior al botón de cobrar', async () => {
    const { registrarVentaAction } = await import('@/app/(app)/modulos/ventas/actions')
    vi.mocked(registrarVentaAction).mockResolvedValue({
      error: 'No hay suficiente stock vendible.',
    })

    const usuario = userEvent.setup()
    render(<Mostrador productos={[botellon]} stock={stock} />)

    /* Sin items el botón está apagado: no hay venta que rechazar. */
    await usuario.click(screen.getByRole('button', { name: /Agregar uno de Paca/i }))

    const cobrar = screen.getByRole('button', { name: /^Cobrar$/i })
    await usuario.click(cobrar)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(/No hay suficiente stock vendible/)

    /*
     * Pegado al botón. Si alguien vuelve a mover el `FormError` al encabezado,
     * esto falla — que es el punto: el formulario mide más de trescientas
     * líneas y el mensaje quedaba fuera de la pantalla.
     */
    expect(cobrar.previousElementSibling).toBe(aviso)
  })
})
