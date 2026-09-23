import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditarNombre } from '@/components/clientes/editar-nombre'
import type { Cliente } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  editarClienteAction: vi.fn(),
}))

/**
 * Corregir el nombre de un cliente ya registrado — RN-CLI-17.
 *
 * ── Lo que se vigila ────────────────────────────────────────────────────────
 *
 * Que el formulario ABRA CON EL NOMBRE PUESTO. Quien entra acá viene a arreglar
 * una letra, no a reescribir cuatro campos: con los campos en blanco, corregir
 * «Padila» significa teclear el nombre entero de nuevo, y ahí es donde se
 * pierde el segundo nombre o el apodo que nadie se acordó de volver a escribir.
 * Y como `api/` reemplaza el nombre ENTERO, lo que no se vuelve a escribir se
 * borra de verdad.
 *
 * Y que la forma de los campos salga de CÓMO ESTÁ NOMBRADO el cliente, no de su
 * tipo. Casi siempre coinciden. Cuando no —un residencial cargado sin partir—,
 * pedirle apellidos borraría el único nombre que tiene.
 */

const cliente = (extra: Partial<Cliente> = {}): Cliente =>
  ({
    id: 'cli-1',
    nombre: 'Rosa Elena Padilla Gómez',
    nombreLibre: null,
    primerNombre: 'Rosa',
    segundoNombre: 'Elena',
    apellidos: 'Padilla Gómez',
    apodo: 'Doña Rosa',
    tipo: 'residencial',
    tipoDocumento: 'CC',
    numeroDocumento: '1234567890',
    documento: '1234567890',
    verificacionEstado: 'pendiente',
    verificadoPor: null,
    verificadoEn: null,
    verificacionMetodo: null,
    creditoHabilitado: false,
    creditoLimite: null,
    activo: true,
    createdAt: '2026-09-07T00:00:00Z',
    updatedAt: '2026-09-07T00:00:00Z',
    ...extra,
  }) as Cliente

const NEGOCIO = cliente({
  nombre: 'Panadería del Centro',
  nombreLibre: 'Panadería del Centro',
  primerNombre: null,
  segundoNombre: null,
  apellidos: null,
  apodo: null,
  tipo: 'comercial',
})

function abrir(c = cliente()) {
  render(<EditarNombre cliente={c} />)
  fireEvent.click(screen.getByRole('button', { name: /corregir el nombre/i }))
}

const campo = (nombre: RegExp) =>
  screen.getByRole('textbox', { name: nombre }) as HTMLInputElement

describe('cómo se abre', () => {
  it('cerrado, el formulario no está montado', () => {
    render(<EditarNombre cliente={cliente()} />)

    expect(screen.queryByRole('textbox', { name: /Primer nombre/ })).not.toBeInTheDocument()
  })

  /**
   * El botón es SOLO el lápiz.
   *
   * Pegado al nombre, el lápiz ya dice qué edita: el contexto hace el trabajo
   * que hacía la etiqueta, y el título deja de competir con un botón tan ancho
   * como él. Pero un ícono no tiene texto, así que el nombre accesible tiene que
   * estar igual — sin `aria-label`, un lector de pantalla anuncia «botón» y no
   * hay contexto visual que lo salve.
   */
  it('es solo el lápiz, sin texto visible', () => {
    render(<EditarNombre cliente={cliente()} />)

    const boton = screen.getByRole('button', { name: /corregir el nombre/i })
    expect(boton.textContent).toBe('')
  })

  /** El nombre accesible nombra al cliente: en la ficha hay más de un lápiz. */
  it('el nombre accesible dice a quién corrige', () => {
    render(<EditarNombre cliente={cliente()} />)

    expect(
      screen.getByRole('button', { name: 'Corregir el nombre de Rosa Elena Padilla Gómez' }),
    ).toBeInTheDocument()
  })
})

describe('abre con lo que ya estaba', () => {
  it('las cuatro partes de una persona llegan puestas', () => {
    abrir()

    expect(campo(/Primer nombre/).value).toBe('Rosa')
    expect(campo(/Segundo nombre/).value).toBe('Elena')
    expect(campo(/Apellidos/).value).toBe('Padilla Gómez')
    expect(campo(/Apodo/).value).toBe('Doña Rosa')
  })

  it('un negocio abre con el suyo, y sin campos de apellido', () => {
    abrir(NEGOCIO)

    expect(campo(/Nombre del negocio/).value).toBe('Panadería del Centro')
    expect(screen.queryByRole('textbox', { name: /Apellidos/ })).not.toBeInTheDocument()
  })

  /** Lo que `api/` devuelve en `null` es un campo vacío, no la palabra «null». */
  it('las partes que faltan quedan vacías', () => {
    abrir(cliente({ segundoNombre: null, apodo: null }))

    expect(campo(/Segundo nombre/).value).toBe('')
    expect(campo(/Apodo/).value).toBe('')
  })
})

/**
 * La forma sale del TIPO, y el dato se acomoda — RN-CLI-20.
 *
 * ── El defecto que este bloque existe para impedir ──────────────────────────
 *
 * Antes salía del DATO: `nombreLibre` presente ⇒ un solo campo. Tenía sentido
 * cuando eso casi siempre era un negocio.
 *
 * Desde que un cliente se registra con lo que quiso dar, «Rosa» sin apellido se
 * guarda en `nombreLibre` —la base no acepta un nombre partido a medias— y
 * editarla abría el formulario de un NEGOCIO. Para partirle el nombre había que
 * borrarlo y escribirlo de nuevo. Lo reportó el usuario usándolo.
 */
describe('la forma sale del tipo de cliente', () => {
  it('una persona guardada sin partir ve los campos partidos, con su nombre puesto', () => {
    abrir(
      cliente({
        nombre: 'Rosa',
        nombreLibre: 'Rosa',
        primerNombre: null,
        segundoNombre: null,
        apellidos: null,
        tipo: 'residencial',
      }),
    )

    expect(campo(/Primer nombre/).value).toBe('Rosa')
    expect(screen.queryByRole('textbox', { name: /Nombre del negocio/ })).not.toBeInTheDocument()
  })

  /* Un negocio sigue viendo su campo único: así se nombra un negocio. */
  it('un comercial sigue con el campo único', () => {
    abrir(
      cliente({
        nombre: 'Tienda de la esquina',
        nombreLibre: 'Tienda de la esquina',
        primerNombre: null,
        segundoNombre: null,
        apellidos: null,
        tipo: 'comercial',
      }),
    )

    expect(campo(/Nombre del negocio/).value).toBe('Tienda de la esquina')
    expect(screen.queryByRole('textbox', { name: /Primer nombre/ })).not.toBeInTheDocument()
  })
})

describe('lo que viaja escondido en el formulario', () => {
  it('el id del cliente y la forma de nombrar', () => {
    abrir()

    const formulario = screen.getByRole('textbox', { name: /Primer nombre/ }).closest('form')!
    const ocultos = Object.fromEntries(
      [...formulario.querySelectorAll('input[type="hidden"]')].map((i) => [
        (i as HTMLInputElement).name,
        (i as HTMLInputElement).value,
      ]),
    )

    expect(ocultos).toEqual({ clienteId: 'cli-1', tipo: 'residencial' })
  })

  it('la forma que viaja es la del TIPO, no la de cómo estaba guardado', () => {
    abrir(
      cliente({
        nombreLibre: 'Rosa',
        primerNombre: null,
        apellidos: null,
        tipo: 'residencial',
      }),
    )

    const formulario = screen.getByRole('textbox', { name: /Primer nombre/ }).closest('form')!
    const tipo = formulario.querySelector('input[name="tipo"]') as HTMLInputElement

    expect(tipo.value).toBe('residencial')
  })

  /** `nombre` es una columna generada: si viajara, `api/` rechazaría la edición. */
  it('el nombre compuesto no es un campo del formulario', () => {
    abrir()

    const formulario = screen.getByRole('textbox', { name: /Primer nombre/ }).closest('form')!
    expect(formulario.querySelector('[name="nombre"]')).toBeNull()
  })
})

/**
 * Cerrar el modal es un EFECTO, no algo que pase durante el render.
 *
 * ── El fallo que esto atrapa ────────────────────────────────────────────────
 *
 * La primera versión cerraba con `if (estado.token) alGuardar()` en el cuerpo
 * del componente: un `setState` del PADRE mientras React renderiza al hijo.
 * React lo rechaza —«Cannot update a component while rendering a different
 * component»— y en la ficha real eso subía al error boundary, que lo mostraba
 * como «No pudimos conectarnos». Guardar funcionaba; la pantalla decía que no.
 *
 * jsdom no lo había visto porque ningún test llegaba a un guardado con token.
 * Este llega.
 */
describe('al guardar con éxito', () => {
  it('cierra sin que React se queje de un setState durante el render', async () => {
    const { editarClienteAction } = await import('@/app/(app)/modulos/clientes/actions')
    vi.mocked(editarClienteAction).mockResolvedValue({ ok: 'Ahora se llama Rosa', token: 'tok-1' })

    const quejas: string[] = []
    const espia = vi.spyOn(console, 'error').mockImplementation((...args) => {
      quejas.push(args.map(String).join(' '))
    })

    abrir()
    fireEvent.submit(screen.getByRole('textbox', { name: /Primer nombre/ }).closest('form')!)

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /Primer nombre/ })).not.toBeInTheDocument(),
    )

    espia.mockRestore()
    expect(quejas.filter((q) => /Cannot update a component/.test(q))).toEqual([])
  })
})
