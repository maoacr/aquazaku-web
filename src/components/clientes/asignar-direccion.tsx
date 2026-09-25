'use client'

import { Pencil } from 'lucide-react'
import { useActionState, useId, useState, useTransition } from 'react'
import {
  asignarDireccionAction,
  direccionesDelClienteAction,
} from '@/app/(app)/modulos/seguimientos/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import type { Direccion } from '@/lib/api-types'
import type { EstadoDeFormulario } from '@/lib/formulario'

/**
 * Asignarle la dirección a una venta que no la registró — M15.
 *
 * ── Qué pasa por detrás, y por qué importa que se sepa ──────────────────────
 *
 * Esto **no edita** la venta. La base no lo permite: el trigger
 * `solo_anulacion_en_ventas` rechaza cualquier cambio que deje la venta en
 * `confirmada` (RN-VEN-02). Lo que ocurre es una **corrección** —la misma que
 * usa Ventas para editar—: se anula la vieja y se registra una nueva con la
 * misma fecha y la dirección puesta.
 *
 * El diálogo lo dice en una línea. No es un detalle técnico de más: quien
 * después mire la auditoría va a ver una venta anulada y otra creada, y tiene
 * que poder reconocer que fue esto y no un error de alguien.
 *
 * Que el stock por lote y el saldo de botellones queden idénticos está medido
 * en `api/src/modules/ventas/__tests__/asignar-direccion.test.ts`, no supuesto.
 *
 * ── El área táctil, no el ícono ─────────────────────────────────────────────
 *
 * `editar-direccion.tsx` ya dejó escrita la lección: «un lápiz de dieciséis
 * píxeles al costado se falla con el pulgar, y esto se usa desde un celular al
 * lado de una llenadora». Acá el lápiz se pidió explícitamente y en una tabla
 * densa no hay una fila entera que ofrecer —la fila ya tiene el enlace a la
 * ficha y los de WhatsApp—, así que la respuesta es el `p-2.5`: el ícono mide
 * 16 px y el blanco clicable mide 44.
 */
const INICIAL: EstadoDeFormulario = {}

export function AsignarDireccion({
  ventaId,
  clienteId,
  nombre,
}: {
  ventaId: string
  clienteId: string
  nombre: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [direcciones, setDirecciones] = useState<Direccion[] | null>(null)
  const [cargando, empezarACargar] = useTransition()
  const [estado, enviar, enviando] = useActionState(asignarDireccionAction, INICIAL)
  const [ultimoToken, setUltimoToken] = useState(estado.token)
  const campo = useId()

  /*
   * ── Ni un solo `useEffect` acá, y no es estilo ──────────────────────────
   *
   * Los dos que había —uno para cargar las direcciones al abrir, otro para
   * cerrar al terminar— los rechaza `react-hooks/set-state-in-effect`, y la
   * regla tiene razón: los dos eran estado sincronizado con un efecto cuando el
   * dato ya estaba disponible antes. Es la misma lección que dejó escrita
   * `EstadoDeFormulario.token`.
   *
   * Cerrar se DERIVA del token, ajustando el estado durante el render. El token
   * cambia en cada éxito, así que dos correcciones seguidas con el mismo
   * mensaje cierran las dos — con `ok` la segunda no dispararía nada.
   */
  if (estado.token !== ultimoToken) {
    setUltimoToken(estado.token)
    setAbierto(false)
  }

  /*
   * Y cargar las direcciones es un EVENTO —alguien tocó el lápiz—, no una
   * sincronización. Va en el handler, que es donde estaba su causa.
   *
   * Se piden al abrir y no con la lista: cuarenta filas traerían las
   * direcciones de cuarenta clientes para que alguien use las de uno, y ésta ya
   * es la pantalla más pesada del módulo.
   */
  const abrir = () => {
    setAbierto(true)

    if (direcciones !== null) return

    empezarACargar(async () => {
      setDirecciones(await direccionesDelClienteAction(clienteId))
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Asignarle la dirección a la última venta de ${nombre}`}
        title="Asignarle la dirección a esta venta"
        className="-m-1 rounded p-2.5 text-tenue transition-colors hover:bg-elevada hover:text-principal"
      >
        <Pencil aria-hidden className="size-4" />
      </button>

      <Modal
        abierto={abierto}
        cerrar={() => setAbierto(false)}
        titulo="¿A qué dirección se entregó?"
      >
        <form action={enviar} className="grid gap-4">
          <input type="hidden" name="ventaId" value={ventaId} />

          <p className="text-[13px] text-secundario">
            Esta venta de <strong>{nombre}</strong> se registró antes de que el sistema pidiera la
            dirección, así que su conteo de días es del cliente y no de una puerta.
          </p>

          {cargando || direcciones === null ? (
            <p className="text-[13px] text-tenue">Buscando las direcciones del cliente…</p>
          ) : direcciones.length === 0 ? (
            /*
             * Sin direcciones activas no hay nada que elegir, y el formulario no
             * puede ofrecer un botón que no lleva a ningún lado. Se dice cuál es
             * el trabajo que falta.
             */
            <p className="text-[13px] text-tenue">
              Este cliente no tiene direcciones activas cargadas. Primero hay que cargarle una en su
              ficha.
            </p>
          ) : (
            <div className="grid gap-1.5">
              <label htmlFor={campo} className="text-[13px] font-medium text-principal">
                Dirección
              </label>
              <select id={campo} name="direccionId" required defaultValue="" className="aq-campo">
                <option value="" disabled>
                  Elija una…
                </option>
                {direcciones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.etiqueta} — {d.legible}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/*
            Lo que va a pasar de verdad, dicho antes de apretar.

            La venta no se edita: se reemplaza. Quien mañana mire la bitácora va
            a encontrar una venta anulada y otra creada con la misma fecha, y
            tiene que poder reconocer que fue esto y no el error de alguien.
          */}
          <p className="rounded-md bg-elevada px-3 py-2 text-[12px] text-tenue ring-1 ring-inset ring-sutil">
            La venta no se edita: se <strong>corrige</strong>. Queda registrada como reemplazada por
            una nueva con la misma fecha y el mismo total. El stock y los botellones no se mueven.
          </p>

          <FormError id={`${campo}-error`}>{estado.error}</FormError>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="aq-boton aq-boton-secundario"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || direcciones === null || direcciones.length === 0}
              className="aq-boton aq-boton-primario"
            >
              {enviando ? 'Corrigiendo…' : 'Asignar dirección'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
