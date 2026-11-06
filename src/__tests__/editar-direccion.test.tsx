import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { EditarDireccion } from '@/components/clientes/editar-direccion'
import type { Departamento, DireccionConBases, Municipio } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  editarDireccionAction: vi.fn(),
  desactivarDireccionAction: vi.fn(),
}))

/**
 * El modal de una dirección — M14.
 *
 * ── Lo que se prueba de verdad ──────────────────────────────────────────────
 *
 * Que la baja **pregunte antes**, y que diga qué va a pasar. Un «¿está seguro?»
 * se contesta que sí sin leer; decir «deja de aparecer, el historial se
 * conserva» le da a la persona algo con qué decidir.
 */

beforeAll(() => {
})

const DEPARTAMENTOS: Departamento[] = [{ codigo: '08', nombre: 'Atlántico' }]
const MUNICIPIOS: Municipio[] = [
  { codigo: '08137', departamento: '08', nombre: 'Campo de la Cruz', lat: 10.378, lng: -74.881 },
]

const direccion = (extra: Partial<DireccionConBases> = {}): DireccionConBases =>
  ({
    id: 'dir-1',
    clienteId: 'cli-1',
    etiqueta: 'el local',
    viaTipo: 'CL',
    viaNumero: '45',
    viaLetra: null,
    placaNumero: '12',
    placaLetra: null,
    placaSegundo: '34',
    placaLetraFinal: null,
    complemento: null,
    municipio: 'campo de la cruz',
    departamento: 'atlántico',
    direccion: null,
    indicaciones: null,
    latitud: null,
    longitud: null,
    legible: 'CL 45 # 12 - 34, Campo de la Cruz',
    activa: true,
    createdAt: '2026-09-07T00:00:00Z',
    basesPrestadas: 0,
    ...extra,
  }) as DireccionConBases

const pintar = (d = direccion()) =>
  render(
    <EditarDireccion
      clienteId="cli-1"
      direccion={d}
      departamentos={DEPARTAMENTOS}
      municipios={MUNICIPIOS}
    />,
  )

describe('cómo se abre', () => {
  /*
   * El objetivo del toque es la dirección entera, no un ícono al costado: un
   * lápiz de dieciséis píxeles se falla con el pulgar, y esto se usa desde un
   * celular al lado de una llenadora.
   */
  it('la dirección entera es el botón', () => {
    pintar()

    expect(screen.getByRole('button', { name: /el local/ })).toBeInTheDocument()
  })

  it('cerrado, el formulario no está montado', () => {
    pintar()

    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })

  it('abierto, trae los valores actuales', () => {
    pintar()
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))

    expect(screen.getByLabelText('Tipo de vía')).toHaveValue('CL')
    expect(screen.getByLabelText('Número de la placa')).toHaveValue('12')
  })
})

/**
 * ── Se da de BAJA, no se elimina ────────────────────────────────────────────
 *
 * Una dirección puede tener bases prestadas. Si desapareciera, el préstamo
 * dejaría de ser reclamable: nadie sabría a cuál de los tres locales ir a
 * buscar la base 0913.
 *
 * El botón dice lo que pasa. Decir «Eliminar» y desactivar sería mentir sobre
 * el propio sistema.
 */
describe('la baja', () => {
  const abrir = () => {
    pintar()
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))
  }

  it('el botón dice «dar de baja», no «eliminar»', () => {
    abrir()

    expect(screen.getByRole('button', { name: /Dar de baja/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument()
  })

  it('pide confirmación antes: no se da de baja de un toque', () => {
    abrir()

    expect(screen.queryByRole('button', { name: /Sí, darla de baja/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.getByRole('button', { name: /Sí, darla de baja/ })).toBeInTheDocument()
  })

  /*
   * Un «¿está seguro?» se contesta que sí sin leer. Decir qué va a pasar le da
   * a la persona algo con qué decidir.
   */
  it('la confirmación dice qué pasa, no solo «¿está seguro?»', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.getByText(/Deja de aparecer para despachar/)).toBeInTheDocument()
    expect(screen.getByText(/historial/)).toBeInTheDocument()
  })

  /*
   * ── El texto decía lo contrario de lo que ahora pasa ──────────────────────
   *
   * Decía «las bases prestadas ahí siguen siendo reclamables», y era verdad
   * mientras la baja solo marcaba la dirección inactiva: la base se quedaba
   * colgada de una puerta que ya no existe.
   *
   * Ahora vuelve al parque. Si el texto siguiera igual, la pantalla estaría
   * describiendo el defecto que acabamos de arreglar.
   */
  it('dice que la base vuelve al parque, no que sigue prestada', () => {
    pintar(direccion({ basesPrestadas: 1 }))
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.getByText(/vuelve al parque/)).toBeInTheDocument()
    expect(screen.queryByText(/siguen siendo reclamables/)).not.toBeInTheDocument()
  })

  /*
   * El número sale de la ficha, que lo calcula con `basesPrestadasEn` — la misma
   * consulta que ejecuta la devolución. Preguntar «¿seguro?» sin decir qué se
   * mueve es pedirle a alguien que decida a ciegas.
   */
  it('dice CUÁNTAS bases van a volver', () => {
    pintar(direccion({ basesPrestadas: 2 }))
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.getByText(/2 bases/)).toBeInTheDocument()
  })

  it('sin bases ahí, no inventa un conteo', () => {
    pintar(direccion({ basesPrestadas: 0 }))
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.getByText(/No hay bases prestadas/)).toBeInTheDocument()
  })

  /*
   * ── El botón apagado DICE por qué ─────────────────────────────────────────
   *
   * Un botón deshabilitado sin explicación manda a la persona a buscar qué le
   * falta. El piso de diez caracteres lo pone `api/`; acá se exige el mismo para
   * poder decirlo antes del viaje, en vez de devolver un 400 que nadie iba a
   * leer.
   */
  it('sin motivo, el botón está apagado y dice por qué', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    expect(screen.getByRole('button', { name: /Sí, darla de baja/ })).toBeDisabled()
    expect(screen.getByText(/al menos 10 caracteres/)).toBeInTheDocument()
  })

  it('con el motivo escrito, el botón se habilita', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))

    fireEvent.change(screen.getByLabelText(/Por qué se da de baja/), {
      target: { value: 'el cliente devolvió el equipo de ese local' },
    })

    expect(screen.getByRole('button', { name: /Sí, darla de baja/ })).toBeEnabled()
  })

  it('se puede cancelar y volver atrás', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('button', { name: /Sí, darla de baja/ })).not.toBeInTheDocument()
  })
})

describe('el catálogo geográfico', () => {
  /*
   * Las opciones de un `datalist` no exponen rol accesible —el navegador las
   * presenta como sugerencias, no como una lista navegable— así que se
   * verifican por su valor, que es lo que el campo va a ofrecer.
   */
  it('sugiere municipios del departamento que ya tiene', () => {
    const { container } = pintar()
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))

    const opciones = [...container.querySelectorAll('#municipios option')].map((o) =>
      o.getAttribute('value'),
    )

    expect(opciones).toContain('Campo de la Cruz')
  })

  /*
   * El DANE lista municipios, no veredas — y Aquazaku reparte en algunas. Es un
   * `datalist`: sugiere sin cerrar la puerta.
   */
  it('pero el campo deja escribir lo que no está en la lista', () => {
    pintar()
    fireEvent.click(screen.getByRole('button', { name: /el local/ }))

    const campo = screen.getByLabelText(/Municipio/)

    expect(campo.tagName).toBe('INPUT')
    expect(campo).toHaveAttribute('list', 'municipios')
  })
})
