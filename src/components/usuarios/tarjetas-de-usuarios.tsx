'use client'

import { Search, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Etiqueta } from '@/components/ui/tabla'
import { Vacio } from '@/components/ui/vacio'
import type { UsuarioListado } from '@/lib/api-types'
import { ROLES_DISPONIBLES } from '@/lib/roles'

/**
 * El directorio de usuarios.
 *
 * ── Por qué tarjetas y no una tabla ─────────────────────────────────────────
 *
 * Era una tabla de seis columnas. En un teléfono eso obliga a scrollear en
 * horizontal para leer UNA fila, y en un sistema donde la respuesta a «¿qué
 * roles tiene Fulano?» tiene que ser de un vistazo, esa es la peor forma
 * posible de mostrarla.
 *
 * Es el mismo cambio que ya se hizo en el tablero y en stock: tarjetas
 * apiladas que pasan a grilla cuando hay ancho.
 *
 * ── Por qué el filtro es del cliente y no de la URL ─────────────────────────
 *
 * Auditoría filtra por query string a propósito: son miles de registros
 * paginados por cursor, y un filtro que se pueda compartir y guardar en
 * favoritos vale la ida al servidor.
 *
 * Acá son ocho personas. Todas ya vinieron en la respuesta, así que filtrar
 * contra el servidor sería un viaje para no traer nada nuevo — y la lista de
 * usuarios filtrada no es algo que alguien mande por WhatsApp.
 */
export function TarjetasDeUsuarios({ usuarios }: { usuarios: UsuarioListado[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<string>('')
  const [soloInactivos, setSoloInactivos] = useState(false)

  const filtrados = useMemo(() => {
    const aguja = busqueda.trim().toLowerCase()

    return usuarios.filter((u) => {
      if (rol && !u.roles.includes(rol as UsuarioListado['roles'][number])) return false
      if (soloInactivos && u.status === 'active') return false
      if (!aguja) return true

      // Nombre Y email: alguien puede acordarse de uno y no del otro.
      return u.name.toLowerCase().includes(aguja) || u.email.toLowerCase().includes(aguja)
    })
  }, [usuarios, busqueda, rol, soloInactivos])

  const hayFiltro = Boolean(busqueda.trim() || rol || soloInactivos)

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">Buscar por nombre o email</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icono"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email"
            className="aq-campo pl-9"
          />
        </label>

        {/* Las mismas fichas que el alta. Un filtro que se ve distinto al
            formulario de al lado se lee como otra cosa. */}
        <div className="flex flex-wrap gap-1.5">
          {ROLES_DISPONIBLES.map((r) => (
            <label key={r} className="aq-ficha aq-ficha-compacta">
              <input
                type="radio"
                name="filtro-rol"
                checked={rol === r}
                // Volver a tocar el rol activo lo apaga. Sin esto hace falta un
                // botón «todos» para deshacer un filtro de un solo clic.
                onClick={() => setRol((actual) => (actual === r ? '' : r))}
                onChange={() => undefined}
                className="sr-only"
              />
              <span className="aq-ficha-caja" aria-hidden />
              <span>{r}</span>
            </label>
          ))}

          <label className="aq-ficha aq-ficha-compacta">
            <input
              type="checkbox"
              checked={soloInactivos}
              onChange={(e) => setSoloInactivos(e.target.checked)}
              className="sr-only"
            />
            <span className="aq-ficha-caja" aria-hidden />
            <span>inactivos</span>
          </label>
        </div>
      </div>

      <p className="aq-micro text-tenue" role="status">
        {filtrados.length === usuarios.length
          ? `${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'}`
          : `${filtrados.length} de ${usuarios.length}`}
      </p>

      {filtrados.length === 0 ? (
        // R50 · Un vacío de filtro NUNCA ofrece crear: el alta está arriba, y
        // sugerirla acá empuja a duplicar a alguien que existe y no se encontró.
        <Vacio
          variante="sin-resultados"
          icono={UserRound}
          titulo="Ningún usuario coincide"
          hrefSinFiltros="/modulos/usuarios"
        >
          Pruebe con otro nombre, otro email, o quite el filtro de rol.
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((u) => (
            <li key={u.id}>
              <TarjetaDeUsuario usuario={u} />
            </li>
          ))}
        </ul>
      )}

      {hayFiltro && filtrados.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setBusqueda('')
            setRol('')
            setSoloInactivos(false)
          }}
          className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
        >
          Quitar filtros
        </button>
      ) : null}
    </section>
  )
}

function TarjetaDeUsuario({ usuario }: { usuario: UsuarioListado }) {
  return (
    <Link href={`/modulos/usuarios/${usuario.id}`} className="aq-tarjeta block h-full p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="aq-titulo-tarjeta truncate text-principal">{usuario.name}</p>
          {/* El email es el identificador con el que entra, así que va en mono:
              es un dato para comparar carácter a carácter, no prosa. */}
          <p className="aq-cifra mt-0.5 truncate text-[13px] text-tenue">{usuario.email}</p>
        </div>

        <Etiqueta tono={usuario.status === 'active' ? 'ok' : 'neutro'}>
          {usuario.status === 'active' ? 'Activo' : 'Inactivo'}
        </Etiqueta>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {usuario.roles.length === 0 ? (
          // Un usuario sin roles entra y no ve nada. Decirlo es mejor que una
          // fila vacía que parece un dato que no cargó.
          <span className="aq-micro text-tenue">Sin roles — entra y no ve ningún módulo</span>
        ) : (
          usuario.roles.map((r) => (
            <span
              key={r}
              className="aq-micro rounded-full border border-sutil px-2 py-0.5 text-secundario"
            >
              {r}
            </span>
          ))
        )}
      </div>

      {usuario.mustChangePassword ? (
        <p className="mt-3 text-[13px] text-tenue">Pendiente de cambiar contraseña</p>
      ) : null}
    </Link>
  )
}
