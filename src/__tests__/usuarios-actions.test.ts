import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cambiarEstadoAction,
  cambiarRolesAction,
  crearUsuarioAction,
} from '@/app/(app)/modulos/usuarios/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

function form(campos: Record<string, string>, roles: string[] = []): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  for (const rol of roles) fd.append('roles', rol)
  return fd
}

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Último `RequestInit` con el que se llamó a `api/`. */
function ultimoPedido(): { url: string; init: RequestInit; body: unknown } {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = llamada[1] as RequestInit
  return { url: llamada[0], init, body: JSON.parse(String(init.body)) }
}

const NUEVO = { email: 'nuevo@aquazaku.com', name: 'Persona', password: 'contrasena-123' }

afterEach(() => {
  vi.clearAllMocks()
})

describe('crearUsuarioAction()', () => {
  it('no gasta un viaje a api/ si faltan campos', async () => {
    const estado = await crearUsuarioAction({}, form({ email: 'a@b.com' }))

    expect(estado.error).toMatch(/Complete/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('manda los roles marcados como conjunto', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { id: 'u1' }))

    await crearUsuarioAction({}, form(NUEVO, ['pos', 'seller']))

    const { url, body } = ultimoPedido()
    expect(url).toBe('/users')
    expect(body).toMatchObject({ email: NUEVO.email, roles: ['pos', 'seller'] })
  })

  it('permite crear sin roles', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { id: 'u1' }))

    const estado = await crearUsuarioAction({}, form(NUEVO))

    expect(ultimoPedido().body).toMatchObject({ roles: [] })
    expect(estado.ok).toBeTruthy()
  })

  it('avisa que la contraseña es de un solo uso', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { id: 'u1' }))

    const estado = await crearUsuarioAction({}, form(NUEVO))

    // El admin tiene que saber que no debe custodiar esa contraseña.
    expect(estado.ok).toMatch(/cambiar la contraseña/i)
  })

  it('traduce el email repetido', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(409, { code: 'EMAIL_EN_USO' }))

    const estado = await crearUsuarioAction({}, form(NUEVO))

    expect(estado.error).toMatch(/Ya existe un usuario con ese email/)
  })

  it('refresca la lista al crear', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(201, { id: 'u1' }))

    await crearUsuarioAction({}, form(NUEVO))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/usuarios')
  })

  it('no refresca si falló: la lista no cambió', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(409, { code: 'EMAIL_EN_USO' }))

    await crearUsuarioAction({}, form(NUEVO))

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('cambiarRolesAction()', () => {
  it('usa PUT: manda el conjunto completo, no un agregado', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await cambiarRolesAction({}, form({ userId: 'u1' }, ['admin']))

    const { url, init, body } = ultimoPedido()
    expect(url).toBe('/users/u1/roles')
    expect(init.method).toBe('PUT')
    expect(body).toEqual({ roles: ['admin'] })
  })

  it('quitar todos los roles manda una lista vacía, no omite el campo', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await cambiarRolesAction({}, form({ userId: 'u1' }))

    // Omitirlo haría que api/ no supiera si es "sin roles" o "no lo toques".
    expect(ultimoPedido().body).toEqual({ roles: [] })
  })

  it('repite tal cual el mensaje de ULTIMO_ADMIN que manda api/', async () => {
    const mensaje =
      'Quitarle el rol admin a este usuario dejaría al sistema sin ningún administrador activo. ' +
      'Asignale el rol admin a otra persona antes de hacerlo.'
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(409, { code: 'ULTIMO_ADMIN', mensaje }),
    )

    const estado = await cambiarRolesAction({}, form({ userId: 'u1' }, ['pos']))

    // Reescribirlo acá con otras palabras crearía dos mensajes que se
    // desincronizan. api/ ya explica qué hacer.
    expect(estado.error).toBe(mensaje)
  })

  it('avisa que el cambio ya está activo, sin re-login (RN-ACC-07)', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    const estado = await cambiarRolesAction({}, form({ userId: 'u1' }, ['pos']))

    expect(estado.ok).toMatch(/sin necesidad de volver a entrar/i)
  })

  it('un 403 dice que falta permiso, no un error genérico', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(403, { code: 'FORBIDDEN' }))

    const estado = await cambiarRolesAction({}, form({ userId: 'u1' }, ['pos']))

    expect(estado.error).toMatch(/permiso/i)
  })
})

describe('cambiarEstadoAction()', () => {
  it('desactiva con PATCH', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    await cambiarEstadoAction({}, form({ userId: 'u1', status: 'inactive' }))

    const { url, init, body } = ultimoPedido()
    expect(url).toBe('/users/u1')
    expect(init.method).toBe('PATCH')
    expect(body).toEqual({ status: 'inactive' })
  })

  it('al desactivar avisa que se cerraron las sesiones', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(respuesta(200, {}))

    const estado = await cambiarEstadoAction({}, form({ userId: 'u1', status: 'inactive' }))

    expect(estado.ok).toMatch(/sesiones/i)
  })

  it('rechaza un estado inventado sin llamar a api/', async () => {
    const estado = await cambiarEstadoAction({}, form({ userId: 'u1', status: 'borrado' }))

    expect(estado.error).toMatch(/Estado inválido/)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('el último admin no se puede desactivar: se muestra el motivo', async () => {
    const mensaje = 'Desactivar a este usuario dejaría al sistema sin ningún administrador activo.'
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      respuesta(409, { code: 'ULTIMO_ADMIN', mensaje }),
    )

    const estado = await cambiarEstadoAction({}, form({ userId: 'u1', status: 'inactive' }))

    expect(estado.error).toBe(mensaje)
  })
})
