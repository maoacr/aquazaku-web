import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useActionState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SelectorDeDireccion } from '@/components/retornables/entrega-de-base'
import { direccionesDeClienteAction } from '@/app/(app)/modulos/clientes/actions'
import type { ClienteElegido, Direccion } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  direccionesDeClienteAction: vi.fn(),
}))


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
