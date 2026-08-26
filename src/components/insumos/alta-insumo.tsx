'use client'

import { useActionState, useEffect, useRef } from 'react'
import { crearInsumoAction, type EstadoDeFormulario } from '@/app/(app)/modulos/insumos/actions'
import { FormError } from '@/components/auth/form-error'
import { avisarExito } from '@/lib/avisos'

const INICIAL: EstadoDeFormulario = {}

/**
 * Alta de insumo — solo `admin`.
 *
 * Dar de alta un insumo es CONFIGURACIÓN, no operación: pasa una vez y no se
 * repite. Por eso vive al final de la pantalla y no arriba — lo que se hace
 * todos los días es registrar entradas, y eso tiene que estar primero.
 *
 * Que el `pos` vea este formulario y reciba un 403 al enviarlo es aceptable:
 * ocultar el formulario sería cosmética (RN-ACC-02), y la barrera real está en
 * `api/`. Lo que NO sería aceptable es que el 403 no explicara nada, y por eso
 * `mensajeDeError` lo traduce.
 */
export function AltaDeInsumo() {
  const [estado, accion, enviando] = useActionState(crearInsumoAction, INICIAL)
  const ultimoAvisado = useRef<string | undefined>(undefined)

  // El éxito se va como toast; el error se queda junto al formulario.
  useEffect(() => {
    if (!estado.token || !estado.ok || estado.token === ultimoAvisado.current) return
    ultimoAvisado.current = estado.token
    avisarExito(estado.ok)
  }, [estado.token, estado.ok])

  return (
    /*
      El `key` del formulario ENTERO lo remonta al crear: son cuatro campos no
      controlados y dejar el código anterior invita a crear el mismo insumo dos
      veces. Con error no hay token, así que lo escrito se conserva.
    */
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-5 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Nuevo insumo</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Se hace una vez por insumo. Después, lo que se registra son las entradas.
        </p>
      </div>

      <FormError id="alta-insumo-error">{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Código</span>
          <input
            name="codigo"
            required
            autoComplete="off"
            placeholder="TAPA_20L"
            // El servidor también lo pasa a mayúsculas: esto es para que se vea
            // mientras se escribe, no para garantizarlo.
            className="aq-campo uppercase"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Nombre</span>
          <input
            name="nombre"
            required
            autoComplete="off"
            placeholder="Tapa para botellón de 20 L"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Stock mínimo</span>
          <input name="minimo" type="number" required min="1" step="1" defaultValue={200} className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>
            Unidades por kilo <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            name="equivalenciaPorKilo"
            type="number"
            min="0.001"
            step="0.001"
            className="aq-campo"
          />
        </label>
      </div>

      <p className="text-[13px] text-tenue">
        El mínimo dispara el aviso: 200 es el valor inicial acordado para tapas y sellos.
        Las unidades por kilo solo hacen falta si el insumo se compra por peso — si todavía
        no se midió, déjelo vacío y cárguelo cuando pese un paquete.
      </p>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Creando…' : 'Crear insumo'}
      </button>
    </form>
  )
}
