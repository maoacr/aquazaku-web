import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BuscadorDeSeguimientos } from '@/components/clientes/buscador-de-seguimientos'
import type { DireccionALlamar } from '@/lib/api-types'

/**
 * El buscador de la lista de seguimientos.
 *
 * ── Qué vigila este archivo ─────────────────────────────────────────────────
 *
 * Que el vacío con búsqueda **no diga lo mismo** que el vacío sin búsqueda. Es
 * el caso que más fácil se rompe y el más caro: «Todavía no hay ninguna venta
 * de botellón» frente a una lista de cuarenta filas que no coincidieron se lee
 * como que se borró la base. Ya pasó en Clientes, y por eso
 * `TarjetasDeClientes` recibe `hayFiltro`.
 *
 * Que el conteo de lo visible se DIGA, porque filtrar sin saber cuántas quedaron
 * obliga a contar a mano.
 *
 * ── Lo que NO vigila ────────────────────────────────────────────────────────
 *
 * El criterio de coincidencia — tildes, apodo, el umbral de los dígitos— se
 * prueba en `buscar-seguimientos.test.ts`, sin montar nada. Acá solo se verifica
 * que el componente USE ese filtro y pinte el resultado.
 */

const fila = (parcial: Partial<DireccionALlamar> = {}): DireccionALlamar => ({
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
  telefonos: [],
  ...parcial,
})

const DOS = [
  fila({ clienteId: 'c1', nombre: 'Yeimy Padilla', apodo: 'La Flaca', ventaId: 'v1' }),
  fila({ clienteId: 'c2', nombre: 'Rosa Elena Padilla Gómez', direccionId: 'd2', ventaId: 'v2' }),
]

function montar(
  filas: DireccionALlamar[],
  opciones: { enElOtroCanal?: DireccionALlamar[]; consultaInicial?: string } = {},
) {
  return render(
    <BuscadorDeSeguimientos
      filas={filas}
      enElOtroCanal={opciones.enElOtroCanal ?? []}
      consultaInicial={opciones.consultaInicial}
      canal="botellones"
      basePath="/modulos/seguimientos"
      productos={[]}
      stock={[]}
    />,
  )
}

/*
 * El valor se PEGA, no se teclea.
 *
 * Con `type`, un input mal cableado —sin `value`— igual muestra lo escrito
 * porque el DOM guarda las teclas, y el test pasa sobre un componente roto.
 * `paste` entrega el valor de una sola vez: si el estado no vuelve al `value`,
 * no se ve nada y el test lo dice.
 */
async function buscar(texto: string) {
  const usuario = userEvent.setup()
  const campo = screen.getByRole('searchbox', { name: /buscar/i })

  await usuario.click(campo)
  await usuario.paste(texto)

  return usuario
}

describe('filtrar la lista', () => {
  it('sin escribir nada se ven todas las filas', () => {
    montar(DOS)

    expect(screen.getByText('Yeimy Padilla')).toBeInTheDocument()
    expect(screen.getByText('Rosa Elena Padilla Gómez')).toBeInTheDocument()
  })

  it('el apodo deja sola a su fila: es lo que recuerda quien marca', async () => {
    montar(DOS)

    await buscar('flaca')

    await waitFor(() => {
      expect(screen.queryByText('Rosa Elena Padilla Gómez')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Yeimy Padilla')).toBeInTheDocument()
  })

  it('«gomez» sin tilde encuentra a «Gómez»: el filtro usa la normalización', async () => {
    montar(DOS)

    await buscar('gomez')

    await waitFor(() => {
      expect(screen.queryByText('Yeimy Padilla')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Rosa Elena Padilla Gómez')).toBeInTheDocument()
  })

  it('borrar la búsqueda devuelve la lista entera', async () => {
    montar(DOS)

    const usuario = await buscar('flaca')
    await waitFor(() => {
      expect(screen.queryByText('Rosa Elena Padilla Gómez')).not.toBeInTheDocument()
    })

    await usuario.click(screen.getByRole('button', { name: /borrar la búsqueda/i }))

    await waitFor(() => {
      expect(screen.getByText('Rosa Elena Padilla Gómez')).toBeInTheDocument()
    })
  })

  it('el botón de borrar no está cuando no hay nada escrito', () => {
    montar(DOS)

    expect(screen.queryByRole('button', { name: /borrar la búsqueda/i })).not.toBeInTheDocument()
  })
})

describe('los dos vacíos dicen cosas distintas', () => {
  /*
   * Este es el test que justifica el archivo.
   *
   * Sin `hayFiltro`, la tabla reusa su mensaje de «nunca hubo ventas» cuando lo
   * que pasó es que la búsqueda no coincidió. Quien ve eso con cuarenta filas
   * cargadas no piensa «busqué mal»: piensa que el sistema perdió los datos.
   */
  it('con búsqueda sin resultados NO dice que nunca hubo ventas', async () => {
    montar(DOS)

    await buscar('zzzz')

    await waitFor(() => {
      expect(screen.queryByText('Yeimy Padilla')).not.toBeInTheDocument()
    })
    expect(screen.queryByText(/todavía no hay ninguna venta/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ninguna dirección coincide/i)).toBeInTheDocument()
  })

  it('sin búsqueda y sin filas sí dice que nunca hubo ventas', () => {
    montar([])

    expect(screen.getByText(/todavía no hay ninguna venta/i)).toBeInTheDocument()
    expect(screen.queryByText(/ninguna dirección coincide/i)).not.toBeInTheDocument()
  })
})

describe('el estado se dice', () => {
  it('cuántas filas quedaron, para no contarlas a mano', async () => {
    montar(DOS)

    await buscar('padilla')

    /* Las dos coinciden: «Padilla» está en los dos nombres. */
    await waitFor(() => {
      expect(screen.getByText(/2 direcciones/i)).toBeInTheDocument()
    })
  })

  it('concuerda en singular cuando queda una sola', async () => {
    montar(DOS)

    await buscar('flaca')

    await waitFor(() => {
      expect(screen.getByText(/^1 dirección\.$/i)).toBeInTheDocument()
    })
  })
})

describe('cuando está en la otra pestaña', () => {
  /*
   * ── El caso que motivó esto ───────────────────────────────────────────────
   *
   * Las dos pestañas son dos relojes distintos, y está bien que la búsqueda no
   * cruce: un cliente al día en botellones y atrasado en pacas son dos hechos
   * separados. Lo que NO está bien es el silencio.
   *
   * «Ninguna dirección coincide» frente a alguien que está a un clic se lee
   * como «esta persona no está en seguimientos». Medido en la base de
   * desarrollo: 12 clientes están SOLO en botellones, así que parado en «Otros
   * productos» hay doce personas que el buscador declara inexistentes.
   */
  const soloEnOtros = fila({
    clienteId: 'c9',
    nombre: 'Marta Quintero',
    direccionId: 'd9',
    ventaId: 'v9',
  })

  it('lo dice, con el nombre de quien buscaba y el de la otra pestaña', async () => {
    montar(DOS, { enElOtroCanal: [soloEnOtros] })

    await buscar('quintero')

    await waitFor(() => {
      expect(screen.getByText(/marta quintero/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/otros productos/i)).toBeInTheDocument()
  })

  it('el link lleva al otro canal CON la búsqueda puesta', async () => {
    montar(DOS, { enElOtroCanal: [soloEnOtros] })

    await buscar('quintero')

    await waitFor(() => {
      const ir = screen.getByRole('link', { name: /otros productos/i })
      expect(ir).toHaveAttribute('href', '/modulos/seguimientos?canal=otros&q=quintero')
    })
  })

  it('cuenta cuántas hay allá, no solo que hay alguna', async () => {
    const otra = fila({ clienteId: 'c8', nombre: 'Marta Quintero', direccionId: 'd8', ventaId: 'v8' })
    montar(DOS, { enElOtroCanal: [soloEnOtros, otra] })

    await buscar('quintero')

    await waitFor(() => {
      expect(screen.getByText(/2 direcciones/i)).toBeInTheDocument()
    })
  })

  it('no avisa nada cuando tampoco está allá: no se inventa una esperanza', async () => {
    montar(DOS, { enElOtroCanal: [soloEnOtros] })

    await buscar('zzzz')

    await waitFor(() => {
      expect(screen.getByText(/ninguna dirección coincide/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /otros productos/i })).not.toBeInTheDocument()
  })

  it('no avisa cuando SÍ hay resultados acá: sería ruido', async () => {
    /*
     * El apodo va en el fixture a propósito: sin él, «flaca» no coincide allá
     * y el aviso faltaría porque no hay nada que avisar, no porque la guarda
     * funcione. El test diría que vigila la guarda sin tocarla — y una ablación
     * lo demostró.
     */
    const tambienAlla = fila({
      clienteId: 'c1',
      nombre: 'Yeimy Padilla',
      apodo: 'La Flaca',
      direccionId: 'dX',
      ventaId: 'vX',
    })
    montar(DOS, { enElOtroCanal: [tambienAlla] })

    await buscar('flaca')

    await waitFor(() => {
      expect(screen.getByText('Yeimy Padilla')).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /otros productos/i })).not.toBeInTheDocument()
  })
})

describe('la búsqueda sembrada desde la URL', () => {
  /*
   * Es la otra mitad del aviso. Sin esto, el link manda a la pestaña correcta
   * con el campo vacío: quien llegó siguiendo un «está en Otros productos»
   * tendría que volver a escribir el nombre que acaba de escribir.
   *
   * El término sigue sin actualizar la URL en cada tecla. Entra una vez, en una
   * navegación que ya iba a ocurrir.
   */
  it('llega filtrando, sin que nadie teclee', () => {
    montar(DOS, { consultaInicial: 'flaca' })

    expect(screen.getByText('Yeimy Padilla')).toBeInTheDocument()
    expect(screen.queryByText('Rosa Elena Padilla Gómez')).not.toBeInTheDocument()
  })

  it('el campo muestra lo que vino en la URL, para poder corregirlo', () => {
    montar(DOS, { consultaInicial: 'flaca' })

    expect(screen.getByRole('searchbox', { name: /buscar/i })).toHaveValue('flaca')
  })
})

describe('el aviso tiene que invitar a reaccionar', () => {
  /*
   * Nació como un renglón de 13 px en color tenue, al lado del conteo. Era
   * correcto y era invisible: la persona acaba de escribir, la tabla quedó
   * vacía, y lo único accionable de la pantalla pesaba menos que el placeholder.
   *
   * Un aviso que no se ve no es un aviso: es una nota al pie. Ahora ocupa el
   * lugar que dejó la lista —que es donde el ojo cae cuando no hay filas— y la
   * salida es un botón, no un link subrayado.
   */
  const soloAlla = fila({
    clienteId: 'c9',
    nombre: 'Marta Quintero',
    direccionId: 'd9',
    ventaId: 'v9',
  })

  it('la salida es un BOTÓN, no un renglón de texto', async () => {
    montar(DOS, { enElOtroCanal: [soloAlla] })

    await buscar('quintero')

    await waitFor(() => {
      const ir = screen.getByRole('link', { name: /ver en otros productos/i })
      expect(ir).toHaveClass('aq-boton')
    })
  })

  it('el aviso reemplaza a la tabla vacía, no se suma debajo', async () => {
    montar(DOS, { enElOtroCanal: [soloAlla] })

    await buscar('quintero')

    /*
     * La tabla vacía decía «Ninguna dirección coincide con lo que buscó. Puede
     * buscarla por nombre…». Debajo del aviso esa sugerencia es ruido: el
     * problema no es CÓMO buscó, es DÓNDE está parado.
     */
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ver en otros productos/i })).toBeInTheDocument()
    })
    expect(screen.queryByText(/puede buscarla por nombre/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('sin coincidencias en ninguna parte, la salida es quitar los filtros', async () => {
    montar(DOS, { enElOtroCanal: [soloAlla] })

    await buscar('zzzz')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /quitar los filtros/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /ver en/i })).not.toBeInTheDocument()
  })

  it('el conteo de arriba se calla cuando el vacío ya habla: un anuncio, no dos', async () => {
    montar(DOS, { enElOtroCanal: [soloAlla] })

    await buscar('quintero')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ver en otros productos/i })).toBeInTheDocument()
    })
    expect(screen.queryByText(/ninguna coincide/i)).not.toBeInTheDocument()
  })
})
