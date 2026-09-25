'use client'

import { Pencil } from 'lucide-react'
import { useState, useTransition } from 'react'
import { ventaParaCorregirAction } from '@/app/(app)/modulos/seguimientos/actions'
import { Modal } from '@/components/ui/modal'
import { Mostrador, correccionDesde } from '@/components/ventas/mostrador'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'

/**
 * Corregir desde Seguimientos la venta que fijó el reloj de una fila — M15.
 *
 * ── Es el MISMO modal de Ventas, no uno parecido ────────────────────────────
 *
 * Hubo una primera versión con un diálogo propio: un `<select>` de direcciones
 * y nada más. Parecía lo mínimo suficiente y era lo peor de los dos mundos.
 *
 * Reconstruía a mano el cuerpo de la corrección —ítems, precios, botellones,
 * la fecha del hecho— duplicando reglas que `correccionDesde` ya resuelve. Y
 * dejaba a quien abre el diálogo sin poder tocar nada más: si además del
 * domicilio faltaba corregir una cantidad, había que salir a Ventas, buscar la
 * venta y volver a empezar.
 *
 * Es la misma decisión que ya tomó `acciones-de-venta.tsx` cuando eligió montar
 * el mostrador entero en vez de un formulario de corrección aparte: quien
 * corrige necesita exactamente las mismas decisiones que quien cobró.
 *
 * ── Qué pasa por detrás, y por qué se dice ──────────────────────────────────
 *
 * Esto no edita la venta: la **corrige**. La base no deja lo primero — el
 * trigger `solo_anulacion_en_ventas` rechaza cualquier cambio que deje la venta
 * en `confirmada` (RN-VEN-02). Se anula la vieja y se registra una nueva con la
 * misma fecha.
 *
 * Que el stock por lote y el saldo de botellones queden idénticos está medido
 * en `api/src/modules/ventas/__tests__/asignar-direccion.test.ts`, no supuesto.
 *
 * ── El área táctil, no el ícono ─────────────────────────────────────────────
 *
 * `editar-direccion.tsx` dejó escrita la lección: «un lápiz de dieciséis
 * píxeles al costado se falla con el pulgar, y esto se usa desde un celular al
 * lado de una llenadora». Acá el lápiz se pidió explícitamente y en una tabla
 * densa no hay una fila entera que ofrecer —ya tiene el enlace a la ficha y los
 * de WhatsApp—, así que la respuesta es el relleno: el ícono mide 16 px y el
 * blanco clicable, 44.
 */
export function CorregirLaVenta({
  ventaId,
  nombre,
  sinDireccion,
  productos,
  stock,
}: {
  ventaId: string
  nombre: string
  /** La venta no registró a qué dirección se entregó: el lápiz es lo que falta. */
  sinDireccion: boolean
  productos: Producto[]
  stock: ResumenDeStock[]
}) {
  const [venta, setVenta] = useState<VentaDelListado | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [cargando, empezarACargar] = useTransition()

  /*
   * Cargar la venta es un EVENTO —alguien tocó el lápiz—, no una
   * sincronización, así que vive en el handler y no en un `useEffect`. Es lo
   * que pide `react-hooks/set-state-in-effect`, y tiene razón: el dato ya
   * estaba disponible cuando ocurrió la causa.
   */
  const abrir = () => {
    setAbierto(true)

    if (venta !== null) return

    empezarACargar(async () => {
      setVenta(await ventaParaCorregirAction(ventaId))
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={
          sinDireccion
            ? `Asignarle la dirección a la venta de ${nombre}`
            : `Corregir la venta de ${nombre}`
        }
        title={sinDireccion ? 'Asignarle la dirección a esta venta' : 'Corregir esta venta'}
        className="rounded p-2.5 text-tenue transition-colors hover:bg-elevada hover:text-principal"
      >
        <Pencil aria-hidden className="size-4" />
      </button>

      <Modal
        abierto={abierto}
        cerrar={() => setAbierto(false)}
        titulo={sinDireccion ? 'Asignarle la dirección a la venta' : 'Corregir la venta'}
      >
        {cargando || venta === null ? (
          <p className="py-6 text-center text-[13px] text-tenue">Buscando la venta…</p>
        ) : (
          <>
            {sinDireccion ? (
              <p className="mb-4 text-[13px] text-secundario">
                Esta venta se registró antes de que el sistema pidiera la dirección, así que su
                conteo de días es del cliente y no de una puerta. Elija a cuál se entregó — y de
                paso corrija cualquier otra cosa que haya quedado mal.
              </p>
            ) : null}

            {/*
              El MISMO mostrador, precargado, y llamado EXACTAMENTE como lo
              llama `acciones-de-venta.tsx`.

              Sin `enModal` y sin un `<div>` envolviéndolo, que es como estaba
              en la primera versión. `enModal` se DERIVA de que haya
              `correccion` —una corrección siempre ocurre dentro de un modal—
              así que pasarlo era ruido, y un envoltorio de más es una capa más
              donde el layout se puede desacomodar. Cuando un formulario ajeno
              se monta en otro lado, la llamada que menos se aparta de la que ya
              funciona es la que menos sorpresas trae.

              `correccionDesde` ya trae la fecha del hecho en la zona de la
              planta, que es lo que hace que FEFO evalúe los lotes como se
              evaluaban ese día. Sin eso, una venta de 43 días rebotaría con
              STOCK_INSUFICIENTE: su lote ya venció.
            */}
            <Mostrador
              productos={productos}
              stock={stock}
              correccion={correccionDesde(venta)}
              alCorregir={() => setAbierto(false)}
            />
          </>
        )}
      </Modal>
    </>
  )
}
