import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AvisoDeOcultas } from '@/components/clientes/aviso-de-ocultas'
import { ClientesParaLlamar } from '@/components/clientes/para-llamar'
import type { DireccionALlamar } from '@/lib/api-types'
import { SacarDeLaLista } from '@/components/clientes/sacar-de-la-lista'

const ocultar = vi.fn()
const mostrar = vi.fn()

vi.mock('@/app/(app)/modulos/seguimientos/actions', () => ({
  ocultarDeSeguimientosAction: (fila: unknown) => ocultar(fila),
  mostrarEnSeguimientosAction: (fila: unknown) => mostrar(fila),
}))

/**
 * Quitar una fila de la lista de seguimientos — RN-CLI-18.
 *
 * ── Qué vigila ──────────────────────────────────────────────────────────────
 *
 * Que viaje la fila COMPLETA: cliente, dirección y canal. Es lo único que la
 * API no puede adivinar, y equivocarse acá no da error — oculta la fila de
 * otra puerta, o la del otro canal, y nadie se enteraría hasta que alguien
 * busque a un cliente que no aparece.
 *
 * Y que el botón diga a QUIÉN saca. En una columna de iconos el texto no cabe,
 * así que el nombre vive en el `aria-label`: sin él, un lector de pantalla
 * anuncia «quitar» cuarenta veces sin decir a quién.
 */

const FILA = { clienteId: 'c1', direccionId: 'd1', canal: 'botellones' as const }

/**
 * Quitar son DOS pasos: la X abre el diálogo y el diálogo confirma.
 *
 * El helper los hace juntos porque casi todos los casos miran lo que VIAJA, no
 * el diálogo. Los que vigilan el diálogo mismo —que explique que no borra nada,
 * que cancelar no haga nada— están en su propio describe y no lo usan.
 */
async function quitar(nombre = /quitar yeimy padilla/i) {
  const usuario = userEvent.setup()

  await usuario.click(screen.getByRole('button', { name: nombre }))
  await usuario.click(screen.getByRole('button', { name: /quitar de la lista/i }))

  return usuario
}

beforeEach(() => {
  ocultar.mockClear()
  mostrar.mockClear()
})

describe('la X de la fila', () => {
  it('manda cliente, dirección y canal: la API no puede adivinar la fila', async () => {
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta={false} />)

    await quitar()

    await waitFor(() => {
      expect(ocultar).toHaveBeenCalledWith(FILA)
    })
  })

  it('la fila SIN dirección manda `null` explícito, no lo omite', async () => {
    const sinDireccion = { ...FILA, direccionId: null }
    render(<SacarDeLaLista fila={sinDireccion} nombre="Yeimy Padilla" estaOculta={false} />)

    await quitar()

    await waitFor(() => {
      expect(ocultar).toHaveBeenCalledWith({ ...FILA, direccionId: null })
    })
  })

  it('dice a quién saca, para quien no ve el icono', () => {
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta={false} />)

    const boton = screen.getByRole('button', { name: /quitar yeimy padilla de esta lista/i })

    expect(boton).toHaveAttribute('title', 'Quitar Yeimy Padilla de esta lista')
  })

  it('en la vista de ocultas, el mismo botón la DEVUELVE', async () => {
    const usuario = userEvent.setup()
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta />)

    await usuario.click(screen.getByRole('button', { name: /devolver yeimy padilla/i }))

    await waitFor(() => {
      expect(mostrar).toHaveBeenCalledWith(FILA)
    })
    expect(ocultar).not.toHaveBeenCalled()
  })
})

describe('el acceso a las ocultas', () => {
  /*
   * Este es el test que justifica el componente. Sin la salida, la X es una
   * trampa: una fila ocultada por error desaparece hasta la próxima venta del
   * cliente, y en el medio nadie lo llama.
   */
  it('con ocultas, ofrece verlas y dice cuántas', () => {
    render(
      <AvisoDeOcultas
        cuantas={3}
        canal="botellones"
        basePath="/modulos/seguimientos"
        modoOcultas={false}
      />,
    )

    const enlace = screen.getByRole('link', { name: /mostrar clientes ocultos \(3\)/i })

    expect(enlace).toHaveAttribute('href', '/modulos/seguimientos?ocultas=1')
  })

  it('sin ninguna oculta no se pinta nada: sería ruido permanente', () => {
    render(
      <AvisoDeOcultas
        cuantas={0}
        canal="botellones"
        basePath="/modulos/seguimientos"
        modoOcultas={false}
      />,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('el canal viaja en el enlace: las ocultas de una pestaña no son las de la otra', () => {
    render(
      <AvisoDeOcultas
        cuantas={2}
        canal="otros"
        basePath="/modulos/seguimientos"
        modoOcultas={false}
      />,
    )

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/modulos/seguimientos?canal=otros&ocultas=1',
    )
  })

  it('en la vista de ocultas, explica el estado y ofrece la vuelta', () => {
    render(
      <AvisoDeOcultas
        cuantas={2}
        canal="botellones"
        basePath="/modulos/seguimientos"
        modoOcultas
      />,
    )

    /* Que vuelven solas con una venta es la mitad que evita el pánico. */
    expect(screen.getByText(/vuelven solas si el cliente registra una venta/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver a la lista/i })).toHaveAttribute(
      'href',
      '/modulos/seguimientos',
    )
  })
})

describe('la fila le pasa a la X el canal que se está mirando', () => {
  /*
   * ── Este describe existe porque una ablación no mató nada ─────────────────
   *
   * Se cambió `canal={canal}` por `canal: 'botellones'` fijo en la fila, y los
   * 29 tests de `clientes-para-llamar` siguieron verdes. O sea: nada vigilaba
   * el cableado del canal hacia la X.
   *
   * Y es el peor defecto posible de esta función, porque NO da error: ocultaría
   * la fila del otro canal. Alguien aprieta la X en «Otros productos», la fila
   * sigue ahí, y la de botellones —que nadie tocó— desaparece. Se descubriría
   * buscando a un cliente que no aparece, días después.
   */
  const unaFila = (parcial: Partial<DireccionALlamar> = {}): DireccionALlamar => ({
    clienteId: 'c1',
    nombre: 'Yeimy Padilla',
    apodo: null,
    documento: '79123456',
    direccionId: 'd1',
    etiqueta: 'la casa',
    direccion: 'Calle 5 # 3 - 20',
    diasSinComprar: 10,
    urgencia: 'urgente',
    ventaSinDireccion: false,
    ventaId: 'v1',
    cuantasVentas: 1,
    ocultadaEn: null,
    telefonos: [],
    ...parcial,
  })

  it('en «Otros productos» manda `otros`, no el canal por defecto', async () => {
    render(
      <ClientesParaLlamar canal="otros" filas={[unaFila()]} productos={[]} stock={[]} />,
    )

    await quitar()

    await waitFor(() => {
      expect(ocultar).toHaveBeenCalledWith({
        clienteId: 'c1',
        direccionId: 'd1',
        canal: 'otros',
      })
    })
  })

  it('en botellones manda `botellones`', async () => {
    render(
      <ClientesParaLlamar canal="botellones" filas={[unaFila()]} productos={[]} stock={[]} />,
    )

    await quitar()

    await waitFor(() => {
      expect(ocultar).toHaveBeenCalledWith({
        clienteId: 'c1',
        direccionId: 'd1',
        canal: 'botellones',
      })
    })
  })

  it('una fila ya oculta ofrece devolverla, no quitarla otra vez', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[unaFila({ ocultadaEn: '2026-11-01T10:00:00Z' })]}
        productos={[]}
        stock={[]}
        hayFiltro={false}
      />,
    )

    expect(screen.getByRole('button', { name: /devolver yeimy padilla/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /quitar yeimy padilla/i })).not.toBeInTheDocument()
  })
})

describe('el diálogo de confirmación', () => {
  /*
   * ── Por qué este diálogo existe ───────────────────────────────────────────
   *
   * La X vive pegada al lápiz, en una columna de iconos que se recorre con el
   * pulgar. Y lo que se deshace solo es el ESTADO, no la consecuencia: entre un
   * clic por error y la próxima compra de ese cliente pueden pasar semanas, y
   * en el medio nadie lo llama — que es el trabajo que esta pantalla existe
   * para que no se pierda.
   */
  it('cancelar NO oculta nada', async () => {
    const usuario = userEvent.setup()
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta={false} />)

    await usuario.click(screen.getByRole('button', { name: /quitar yeimy padilla/i }))
    await usuario.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(ocultar).not.toHaveBeenCalled()
  })

  it('el primer clic no oculta: solo abre el diálogo', async () => {
    const usuario = userEvent.setup()
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta={false} />)

    await usuario.click(screen.getByRole('button', { name: /quitar yeimy padilla/i }))

    expect(ocultar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /quitar de la lista/i })).toBeInTheDocument()
  })

  /*
   * Lo primero que dice es lo que NO pasa. Quien aprieta una X en un sistema de
   * gestión teme haber borrado algo; si la primera línea no lo descarta, la duda
   * se resuelve cancelando y la función no se usa nunca.
   */
  it('aclara que no borra nada y que vuelve con una venta', async () => {
    const usuario = userEvent.setup()
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta={false} />)

    await usuario.click(screen.getByRole('button', { name: /quitar yeimy padilla/i }))

    expect(screen.getByText(/no se borra nada/i)).toBeInTheDocument()
    expect(screen.getByText(/vuelve solo/i)).toBeInTheDocument()
  })

  it('el diálogo nombra a quién saca, no pregunta en abstracto', async () => {
    const usuario = userEvent.setup()
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta={false} />)

    await usuario.click(screen.getByRole('button', { name: /quitar yeimy padilla/i }))

    expect(screen.getByText(/¿quitar a yeimy padilla de esta lista\?/i)).toBeInTheDocument()
  })

  /*
   * La asimetría es deliberada: un diálogo frena lo que puede costar un cliente,
   * no lo que lo recupera. Confirmar las dos cosas enseñaría a apretar «Sí» sin
   * leer, y ahí el diálogo deja de proteger.
   */
  it('DEVOLVER a la lista no se confirma: no hay nada que perder', async () => {
    const usuario = userEvent.setup()
    render(<SacarDeLaLista fila={FILA} nombre="Yeimy Padilla" estaOculta />)

    await usuario.click(screen.getByRole('button', { name: /devolver yeimy padilla/i }))

    await waitFor(() => {
      expect(mostrar).toHaveBeenCalledWith(FILA)
    })
  })
})
