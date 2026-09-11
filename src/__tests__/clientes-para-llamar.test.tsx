import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClientesParaLlamar } from '@/components/clientes/para-llamar'
import type { ClienteALlamar } from '@/lib/api-types'

/**
 * Los clientes para llamar — M15.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que el botón de WhatsApp **no aparezca sobre un fijo**. `wa.me` con un número
 * que no tiene WhatsApp abre la app y contesta que no existe: un callejón sin
 * salida que quien atiende lee como «el sistema está roto», y que lo hace
 * desconfiar del botón también donde sí funciona.
 *
 * Y que el enlace lleve al número CORRECTO. Un dedazo ahí manda el mensaje de
 * un cliente al teléfono de otro — con su nombre adentro.
 */

const cliente = (parcial: Partial<ClienteALlamar> = {}): ClienteALlamar => ({
  clienteId: 'c1',
  nombre: 'Yeimy Padilla',
  documento: '79123456',
  diasSinComprar: 10,
  urgencia: 'urgente',
  telefonos: [],
  ...parcial,
})

describe('sin nadie a quien llamar', () => {
  /*
   * La lista vacía es una buena noticia, y hay que decirla. Una sección que
   * desaparece se lee como una sección rota: quien la vio ayer y hoy no la
   * encuentra no piensa «no hay nadie», piensa «se cayó algo».
   */
  it('lo dice, en vez de desaparecer', () => {
    render(<ClientesParaLlamar clientes={[]} />)

    expect(screen.getByText(/al día/i)).toBeInTheDocument()
  })
})

describe('el botón de WhatsApp', () => {
  it('aparece sobre un celular, apuntando a wa.me', () => {
    render(
      <ClientesParaLlamar
        clientes={[
          cliente({
            telefonos: [
              { numero: '300 123 4567', etiqueta: 'el celular', whatsapp: '573001234567' },
            ],
          }),
        ]}
      />,
    )

    const enlace = screen.getByRole('link', { name: /whatsapp/i })
    expect(enlace).toHaveAttribute('href', 'https://wa.me/573001234567')
  })

  /*
   * La otra mitad, y la que de verdad importa: sobre un fijo NO se dibuja.
   * Sin este test, mostrarlo siempre pasaría el de arriba.
   */
  it('NO aparece sobre un fijo', () => {
    render(
      <ClientesParaLlamar
        clientes={[
          cliente({
            telefonos: [{ numero: '605 878 1234', etiqueta: 'el fijo', whatsapp: null }],
          }),
        ]}
      />,
    )

    expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull()
  })

  it('el fijo igual se muestra: se puede llamar aunque no se pueda escribir', () => {
    render(
      <ClientesParaLlamar
        clientes={[
          cliente({
            telefonos: [{ numero: '605 878 1234', etiqueta: 'el fijo', whatsapp: null }],
          }),
        ]}
      />,
    )

    expect(screen.getByText('605 878 1234')).toBeInTheDocument()
  })

  /*
   * Con dos números, cada enlace tiene que ir al suyo. Es la equivocación más
   * cara de esta pantalla: el mensaje sale con el nombre de un cliente al
   * teléfono de otro.
   */
  it('con dos clientes, cada enlace va a su número', () => {
    render(
      <ClientesParaLlamar
        clientes={[
          cliente({
            clienteId: 'c1',
            nombre: 'Yeimy Padilla',
            telefonos: [{ numero: '300 111 1111', etiqueta: null, whatsapp: '573001111111' }],
          }),
          cliente({
            clienteId: 'c2',
            nombre: 'Tienda La Esquina',
            documento: '900123456',
            diasSinComprar: 6,
            urgencia: 'aviso',
            telefonos: [{ numero: '300 222 2222', etiqueta: null, whatsapp: '573002222222' }],
          }),
        ]}
      />,
    )

    const deYeimy = screen.getByRole('listitem', { name: /Yeimy Padilla/ })
    const deTienda = screen.getByRole('listitem', { name: /Tienda La Esquina/ })

    expect(within(deYeimy).getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/573001111111',
    )
    expect(within(deTienda).getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/573002222222',
    )
  })
})

describe('sin teléfono cargado', () => {
  /*
   * Aparece igual, y dice qué falta. Esconderlo lo dejaría invisible para
   * siempre: nadie sabría que hay un cliente al que no se le puede avisar.
   */
  it('dice que falta el número, y no un desplegable vacío', () => {
    render(<ClientesParaLlamar clientes={[cliente({ telefonos: [] })]} />)

    expect(screen.getByText(/sin teléfono/i)).toBeInTheDocument()
    expect(screen.getByText(/Yeimy Padilla/)).toBeInTheDocument()
  })
})

describe('las dos franjas se distinguen', () => {
  it('urgente y aviso no se ven igual', () => {
    render(
      <ClientesParaLlamar
        clientes={[
          /*
           * Nombres que NO contienen la palabra «urgente». El primer intento
           * los llamó «La urgente» y «La del aviso», y el test falló por
           * encontrar dos coincidencias: el nombre y el distintivo. Un dato de
           * prueba que se parece a lo que se busca no prueba nada.
           */
          cliente({ clienteId: 'c1', nombre: 'Rosa Padilla', urgencia: 'urgente' }),
          cliente({
            clienteId: 'c2',
            nombre: 'Ana Beltrán',
            urgencia: 'aviso',
            diasSinComprar: 6,
          }),
        ]}
      />,
    )

    /*
     * Se mira el TEXTO y no la clase de color. Una diferencia que solo existe
     * en el color no la ve quien no distingue rojo de ámbar — y en la planta
     * la pantalla se mira de reojo entre clientes.
     */
    const urgente = screen.getByRole('listitem', { name: /Rosa Padilla/ })
    const aviso = screen.getByRole('listitem', { name: /Ana Beltrán/ })

    expect(within(urgente).getByText(/urgente/i)).toBeInTheDocument()
    expect(within(aviso).queryByText(/urgente/i)).toBeNull()
  })

  it('dice cuántos días lleva sin comprar', () => {
    render(<ClientesParaLlamar clientes={[cliente({ diasSinComprar: 12 })]} />)

    expect(screen.getByText(/12 días/)).toBeInTheDocument()
  })
})
