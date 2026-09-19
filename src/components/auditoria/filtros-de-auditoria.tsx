'use client'

import { useState } from 'react'
import { MODULOS_AUDITABLES, moduloDeLaAccion } from '@/lib/auditoria-catalogo'
import type { FiltrosDeAuditoria as Filtros } from './vista-auditoria'

/**
 * Filtros de la bitácora.
 *
 * ── Sigue navegando por GET ─────────────────────────────────────────────────
 *
 * El formulario navega, no guarda estado de aplicación: los filtros aplicados
 * viven en la URL, así se comparten, se guardan en favoritos y el botón de
 * atrás funciona. Lo único que vive en memoria es qué módulo está elegido en
 * este momento, y solo para saber qué acciones ofrecer en el segundo
 * desplegable. Apenas se aprieta «Filtrar», la URL vuelve a mandar.
 *
 * ── Por qué es cliente y el resto de la pantalla no ─────────────────────────
 *
 * Encadenar dos desplegables —que el segundo dependa del primero sin recargar—
 * necesita JavaScript. Es la barra de filtros y nada más: la tabla, la consulta
 * y la paginación siguen resolviéndose en el servidor.
 */
export function FiltrosDeAuditoria({
  filtros,
  ruta,
}: {
  filtros: Filtros
  ruta: string
}) {
  /*
   * El módulo puede venir explícito (`?resource=ventas`) o implícito dentro de
   * la acción (`?action=ventas:crear`). Derivarlo del segundo hace que un link
   * compartido con solo la acción abra la pantalla con los dos desplegables ya
   * puestos, en vez de con el de acción vacío y el usuario sin entender qué
   * está filtrando.
   */
  const [modulo, setModulo] = useState(filtros.resource ?? moduloDeLaAccion(filtros.action) ?? '')
  const [accion, setAccion] = useState(filtros.action ?? '')

  const acciones = MODULOS_AUDITABLES.find((m) => m.valor === modulo)?.acciones ?? []

  return (
    <form action={ruta} method="get" className="aq-tarjeta grid gap-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="aq-etiqueta-campo">
          <span>Módulo</span>
          <select
            /*
             * Sin `name` no viaja, y eso es a propósito.
             *
             * La acción ya dice a qué módulo pertenece —es `modulo:accion`—,
             * así que mandar los dos es redundante. Y peor que redundante: la
             * API los combina con AND, así que basta UNA fila donde el
             * `resource` no sea el prefijo del `action` para que el filtro
             * devuelva cero. Pasó: `alertas` escribía `configuracion:editar`
             * con `resource: 'parametros'`. El código ya está corregido, pero
             * `audit_log` es append-only y esas filas viejas se quedan ahí
             * para siempre. Mandando solo la acción, aparecen igual.
             */
            name={accion ? undefined : 'resource'}
            value={modulo}
            onChange={(e) => {
              setModulo(e.target.value)
              // Cambiar de módulo invalida la acción elegida: `ventas:anular`
              // no existe dentro de «Clientes». Sin este reset, el formulario
              // se enviaría con un par imposible y la tabla saldría vacía sin
              // que nada explique por qué.
              setAccion('')
            }}
            className="aq-campo"
          >
            <option value="">Todos</option>
            {MODULOS_AUDITABLES.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Acción</span>
          <select
            name="action"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            disabled={!modulo}
            className="aq-campo"
          >
            {/* Sin módulo no hay nada que ofrecer, y decirlo es mejor que un
                desplegable vacío que parece roto. Trato de usted: el sistema de
                diseño lo exige y `voz.test.ts` lo vigila. */}
            <option value="">{modulo ? 'Todas' : 'Primero escoja un módulo'}</option>
            {acciones.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Resultado</span>
          <select name="result" defaultValue={filtros.result ?? ''} className="aq-campo">
            <option value="">Todos</option>
            <option value="ok">Permitidos</option>
            {/* Ver solo los denegados es la consulta de seguridad más útil. */}
            <option value="denied">Denegados</option>
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Desde</span>
          <input name="desde" type="date" defaultValue={filtros.desde ?? ''} className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Hasta</span>
          <input name="hasta" type="date" defaultValue={filtros.hasta ?? ''} className="aq-campo" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="aq-boton aq-boton-primario">
          Filtrar
        </button>
        {/* Un link y no un reset: `reset` devuelve los campos a sus valores
            iniciales, que son justamente los filtros aplicados. */}
        <a href={ruta} className="aq-boton aq-boton-secundario">
          Limpiar
        </a>
      </div>
    </form>
  )
}
