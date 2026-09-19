import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TarjetasDeUsuarios } from '@/components/usuarios/tarjetas-de-usuarios'
import type { UsuarioListado } from '@/lib/api-types'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

/**
 * El directorio de usuarios.
 *
 * ── Por qué el filtro es del cliente y no de la URL ─────────────────────────
 *
 * Auditoría filtra por query string a propósito: son miles de registros
 * paginados por cursor, y un filtro que se pueda compartir vale la ida al
 * servidor. Acá son ocho personas, todas ya vinieron en la respuesta — filtrar
 * contra el servidor sería un viaje para no traer nada nuevo.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que un usuario SIN ROLES se vea como tal. Entra y no ve ningún módulo, y una
 * fila vacía se lee como un dato que no cargó — no como el problema que es.
 *
 * Que el vacío de filtro NUNCA ofrezca crear (R50). El alta está arriba, y
 * sugerirla acá empuja a duplicar a alguien que existe y no se encontró.
 *
 * Y que volver a tocar el rol activo lo APAGUE: sin eso hace falta un botón
 * «todos» para deshacer un filtro de un solo clic.
 */

function usuario(over: Partial<UsuarioListado> = {}): UsuarioListado {
  return {
    id: 'usr-1',
    email: 'rosa@aquazaku.co',
    name: 'Rosa Padilla',
    status: 'active',
    mustChangePassword: false,
    roles: ['seller'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const ROSA = usuario({ id: 'usr-1', name: 'Rosa Padilla', email: 'rosa@aquazaku.co', roles: ['seller'] })
const CARLOS = usuario({
  id: 'usr-2',
  name: 'Carlos Gómez',
  email: 'carlos@aquazaku.co',
  roles: ['admin', 'contador'],
})
const BAJA = usuario({
  id: 'usr-3',
  name: 'Pedro Ruiz',
  email: 'pedro@aquazaku.co',
  roles: ['pos'],
  status: 'inactive',
})

function buscador(): HTMLElement {
  return screen.getByRole('searchbox')
}

/*
 * El primero de los `role="status"`: cuando no coincide nadie, el vacío monta
 * el suyo, y un `getByRole` a secas encontraría los dos.
 */
function conteo(): string {
  return screen.getAllByRole('status')[0].textContent ?? ''
}

function fichaDeRol(rol: string): HTMLElement {
  return screen.getByRole('radio', { name: rol })
}

describe('el conteo dice si hay filtro puesto', () => {
  it('sin filtro dice cuántos hay, en plural', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    expect(conteo()).toBe('2 usuarios')
  })

  it('con uno solo lo dice en singular', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    expect(conteo()).toBe('1 usuario')
  })

  /*
   * «2 de 8» avisa que hay gente escondida detrás del filtro. Decir «2
   * usuarios» haría creer que el sistema tiene dos personas.
   */
  it('con filtro dice cuántos de cuántos: hay gente escondida', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS, BAJA]} />)

    await usuarioTest.type(buscador(), 'rosa')

    expect(conteo()).toBe('1 de 3')
  })
})

describe('la búsqueda mira nombre y email', () => {
  it('encuentra por nombre', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.type(buscador(), 'Carlos')

    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.queryByText('Rosa Padilla')).not.toBeInTheDocument()
  })

  /*
   * Alguien puede acordarse del email y no del nombre — sobre todo de quien
   * entró hace meses.
   */
  it('encuentra por email', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.type(buscador(), 'carlos@')

    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.queryByText('Rosa Padilla')).not.toBeInTheDocument()
  })

  it('no distingue mayúsculas', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    await usuarioTest.type(buscador(), 'ROSA')

    expect(screen.getByText('Rosa Padilla')).toBeInTheDocument()
  })

  it('una búsqueda de solo espacios no filtra nada', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.type(buscador(), '   ')

    expect(conteo()).toBe('2 usuarios')
  })
})

describe('el filtro por rol', () => {
  it('deja solo a quien tiene ese rol', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.click(fichaDeRol('admin'))

    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.queryByText('Rosa Padilla')).not.toBeInTheDocument()
  })

  /*
   * RN-ACC-01: un usuario tiene N roles a la vez. Filtrar por `contador` tiene
   * que encontrar a quien también es `admin` — no existe «rol principal».
   */
  it('encuentra por cualquiera de sus roles, no solo por el primero', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.click(fichaDeRol('contador'))

    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
  })

  /*
   * Sin esto hace falta un botón «todos» para deshacer un filtro que se puso
   * de un solo clic.
   */
  it('volver a tocar el rol activo lo apaga', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.click(fichaDeRol('admin'))
    expect(conteo()).toBe('1 de 2')

    await usuarioTest.click(fichaDeRol('admin'))
    expect(conteo()).toBe('2 usuarios')
  })

  it('tocar otro rol cambia el filtro en vez de sumarlo', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.click(fichaDeRol('admin'))
    await usuarioTest.click(fichaDeRol('seller'))

    expect(screen.getByText('Rosa Padilla')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Gómez')).not.toBeInTheDocument()
  })

  it('ofrece los cuatro roles del sistema', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    for (const rol of ['admin', 'seller', 'pos', 'contador']) {
      expect(fichaDeRol(rol)).toBeInTheDocument()
    }
  })
})

describe('el filtro de inactivos', () => {
  it('apagado muestra a todos', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA, BAJA]} />)

    expect(conteo()).toBe('2 usuarios')
  })

  it('encendido deja solo a los dados de baja', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, BAJA]} />)

    await usuarioTest.click(screen.getByRole('checkbox', { name: 'inactivos' }))

    expect(screen.getByText('Pedro Ruiz')).toBeInTheDocument()
    expect(screen.queryByText('Rosa Padilla')).not.toBeInTheDocument()
  })

  it('se combina con la búsqueda en vez de reemplazarla', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, BAJA]} />)

    await usuarioTest.click(screen.getByRole('checkbox', { name: 'inactivos' }))
    await usuarioTest.type(buscador(), 'rosa')

    expect(conteo()).toBe('0 de 2')
  })
})

describe('cuando no coincide nadie', () => {
  /*
   * R50: un vacío de filtro NUNCA ofrece crear. El alta está arriba, y
   * sugerirla acá empuja a duplicar a alguien que existe y no se encontró.
   */
  it('no ofrece dar de alta a nadie', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    await usuarioTest.type(buscador(), 'nadie')

    expect(screen.getByText(/Ningún usuario coincide/)).toBeInTheDocument()
    expect(screen.queryByText(/Crear/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Dar de alta/i)).not.toBeInTheDocument()
  })

  it('sugiere qué probar, no solo que no hay nada', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    await usuarioTest.type(buscador(), 'nadie')

    expect(screen.getByText(/quite el filtro de rol/)).toBeInTheDocument()
  })

  it('con la lista vacía tampoco ofrece crear', () => {
    render(<TarjetasDeUsuarios usuarios={[]} />)

    expect(screen.getByText(/Ningún usuario coincide/)).toBeInTheDocument()
  })
})

describe('el botón de quitar filtros', () => {
  it('no aparece sin filtro puesto', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })

  it('aparece con filtro puesto y resultados', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS]} />)

    await usuarioTest.click(fichaDeRol('admin'))

    expect(screen.getByRole('button', { name: /Quitar filtros/ })).toBeInTheDocument()
  })

  /*
   * Sin resultados el botón no va: el vacío ya trae su propio camino de
   * vuelta, y dos formas de deshacer lo mismo compiten entre sí.
   */
  it('no aparece cuando no hay resultados: el vacío ya ofrece la salida', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    await usuarioTest.type(buscador(), 'nadie')

    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })

  it('devuelve la lista completa de un clic', async () => {
    const usuarioTest = userEvent.setup()
    render(<TarjetasDeUsuarios usuarios={[ROSA, CARLOS, BAJA]} />)

    await usuarioTest.type(buscador(), 'rosa')
    await usuarioTest.click(fichaDeRol('seller'))
    await usuarioTest.click(screen.getByRole('button', { name: /Quitar filtros/ }))

    expect(conteo()).toBe('3 usuarios')
    expect(buscador()).toHaveValue('')
  })
})

describe('la tarjeta de cada usuario', () => {
  it('lleva a su ficha', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA]} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/modulos/usuarios/usr-1')
  })

  it('marca activo e inactivo', () => {
    render(<TarjetasDeUsuarios usuarios={[ROSA, BAJA]} />)

    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  /*
   * Se busca DENTRO de la tarjeta: las fichas del filtro de arriba también
   * dicen «admin», y un query global encontraría esas.
   */
  it('muestra todos sus roles, no uno solo', () => {
    render(<TarjetasDeUsuarios usuarios={[CARLOS]} />)

    const tarjeta = within(screen.getByRole('link'))
    expect(tarjeta.getByText('admin')).toBeInTheDocument()
    expect(tarjeta.getByText('contador')).toBeInTheDocument()
  })

  /*
   * Un usuario sin roles entra y no ve ningún módulo. Decirlo es mejor que una
   * fila vacía, que se lee como un dato que no cargó.
   */
  it('dice qué le pasa a quien no tiene roles', () => {
    render(<TarjetasDeUsuarios usuarios={[usuario({ roles: [] })]} />)

    expect(screen.getByText(/entra y no ve ningún módulo/)).toBeInTheDocument()
  })

  it('avisa quién tiene la contraseña pendiente', () => {
    render(
      <TarjetasDeUsuarios
        usuarios={[usuario({ mustChangePassword: true }), usuario({ id: 'usr-9' })]}
      />,
    )

    expect(screen.getAllByText(/Pendiente de cambiar contraseña/)).toHaveLength(1)
  })
})
