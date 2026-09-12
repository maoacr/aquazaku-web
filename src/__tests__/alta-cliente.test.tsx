import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AltaDeCliente } from '@/components/clientes/alta-cliente'

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  crearClienteAction: vi.fn(),
  agregarDireccionAction: vi.fn(),
  editarDireccionAction: vi.fn(),
  desactivarDireccionAction: vi.fn(),
  verificarDocumentoAction: vi.fn(),
  configurarCreditoAction: vi.fn(),
  revertirVerificacionAction: vi.fn(),
  cambiarEstadoClienteAction: vi.fn(),
  agregarTelefonoAction: vi.fn(),
  desactivarTelefonoAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

/**
 * El alta de cliente — RN-CLI-13 y RN-CLI-17.
 *
 * ── El defecto que este archivo existe para impedir ─────────────────────────
 *
 * El tipo de documento estaba con `defaultValue`, que un `<select>` solo mira
 * al montar. Elegir «Un negocio» dejaba el documento en «Cédula de ciudadanía»,
 * porque cambiar el tipo no remonta nada — y quedaba un negocio registrado con
 * CC, que después nadie sabe si fue error o decisión.
 *
 * Se encontró abriendo la pantalla, no leyendo el código: en el JSX la línea se
 * leía perfecta.
 *
 * El control pasó de `<select>` a dos fichas de radio —son dos opciones fijas,
 * y un desplegable cobraba dos clics y el ancho de un campo entero para mostrar
 * una sola—. Lo que estos casos vigilan no cambió: que la propuesta SIGA al
 * tipo de cliente, y que se pueda contradecir a mano.
 */

beforeEach(() => {
  vi.clearAllMocks()
})

const alta = () => render(<AltaDeCliente departamentos={[]} municipios={[]} />)

describe('el formulario sigue al tipo de cliente', () => {
  it('arranca pidiendo nombre y apellidos', () => {
    alta()

    expect(screen.getByRole('textbox', { name: /Primer nombre/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Cédula de ciudadanía/ })).toBeChecked()
  })

  it('elegir «Un negocio» cambia los campos Y el documento', async () => {
    const usuario = userEvent.setup()
    alta()

    await usuario.click(screen.getByRole('radio', { name: /Un negocio/ }))

    expect(screen.getByRole('textbox', { name: /Nombre del negocio/ })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Apellidos/ })).toBeNull()
    expect(screen.getByRole('radio', { name: 'NIT' })).toBeChecked()
  })

  it('volver a «Una persona» propone la cédula de nuevo', async () => {
    const usuario = userEvent.setup()
    alta()

    await usuario.click(screen.getByRole('radio', { name: /Un negocio/ }))
    await usuario.click(screen.getByRole('radio', { name: /Una persona/ }))

    expect(screen.getByRole('radio', { name: /Cédula de ciudadanía/ })).toBeChecked()
  })

  /**
   * Proponer no es imponer: hay negocios chicos que operan con la cédula del
   * dueño, y el sistema no tiene por qué discutirlo.
   */
  it('el documento propuesto se puede cambiar a mano', async () => {
    const usuario = userEvent.setup()
    alta()

    await usuario.click(screen.getByRole('radio', { name: /Un negocio/ }))
    await usuario.click(screen.getByRole('radio', { name: /Cédula de ciudadanía/ }))

    expect(screen.getByRole('radio', { name: /Cédula de ciudadanía/ })).toBeChecked()
  })
})

describe('lo que el alta pide, y lo que no', () => {
  it('pide teléfono, porque sin número no hay a quién llamar', () => {
    alta()

    expect(screen.getByRole('textbox', { name: /Teléfono/ })).toBeInTheDocument()
  })

  /**
   * La dirección NO está en el primer paso, y es la decisión central de esta
   * pantalla: es el campo más largo del sistema, y ponerlo antes de guardar
   * convierte el alta en un trámite que se abandona a la mitad.
   */
  it('NO pide la dirección antes de crear al cliente', () => {
    alta()

    expect(screen.queryByRole('textbox', { name: /Indicaciones/ })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /Departamento/ })).toBeNull()
  })
})
