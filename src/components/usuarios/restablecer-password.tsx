'use client'

import { KeyRound } from 'lucide-react'
import { useActionState } from 'react'
import { FormError } from '@/components/auth/form-error'
import {
  restablecerPasswordAction,
  type EstadoDeRestablecer,
} from '@/app/(app)/modulos/usuarios/actions'

const INICIAL: EstadoDeRestablecer = {}

/**
 * Restablecer la contraseña de un usuario, en persona.
 *
 * ── Por qué no hay una pantalla que MUESTRE la contraseña ────────────────────
 *
 * Es lo que se pidió primero, y no se puede: `accounts.password` guarda un hash
 * argon2id, que es de una sola vía. El sistema no tiene la contraseña de nadie
 * — tiene una huella que sirve para verificar un intento, no para reconstruirlo.
 *
 * Y no se haría igual aunque se pudiera, por una razón que es de Aquazaku y no
 * genérica: si el admin ve las contraseñas, el `audit_log` deja de probar nada.
 * «pos@aquazaku.com anuló esta venta» pasaría a significar «alguien que sabía
 * esa clave lo hizo», y esa lista incluye al admin.
 *
 * Esto resuelve el problema real —que nadie dependa del correo para volver a
 * entrar, con ocho personas y no todas con correo a mano— sin ese costo.
 *
 * Client Component por `useActionState`: la temporal viene en la respuesta de la
 * acción, y sin él ese valor se descarta y no hay nada que dictar.
 */
export function RestablecerPassword({ userId, nombre }: { userId: string; nombre: string }) {
  const [estado, accion, enviando] = useActionState(restablecerPasswordAction, INICIAL)

  return (
    <section className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Contraseña</h2>
        <p className="mt-1 text-[13px] text-tenue">
          El sistema guarda un resumen cifrado, no la contraseña: nadie —tampoco un
          administrador— puede leerla. Lo que sí puede hacer es entregar una temporal.
        </p>
      </div>

      <FormError id="restablecer-error">{estado.error}</FormError>

      {estado.temporal ? (
        /*
          Se muestra UNA vez. Al recargar no vuelve, y es a propósito: dejarla a
          la vista la volvería permanente y legible por más gente que la que la
          necesita. Es la misma decisión que tomó `api/` al no auditar el valor.
        */
        <div className="grid gap-2 rounded-lg border border-exito-borde bg-exito-fondo p-4 text-exito-texto">
          <p className="aq-micro">Contraseña temporal para {nombre}</p>

          <p className="aq-cifra text-[22px] font-semibold tracking-wider">{estado.temporal}</p>

          <p className="text-[13px]">
            {estado.ok} No vuelve a mostrarse: si se pierde, restablézcala otra vez.
          </p>
        </div>
      ) : null}

      <form action={accion} className="grid gap-2">
        <input type="hidden" name="userId" value={userId} />

        <button
          type="submit"
          disabled={enviando}
          className="aq-boton aq-boton-secundario justify-self-start"
        >
          <KeyRound aria-hidden className="size-4" />
          {enviando ? 'Restableciendo…' : 'Restablecer contraseña'}
        </button>

        <p className="text-[13px] text-tenue">
          Cierra las sesiones abiertas de esa persona y la obliga a elegir una nueva al
          entrar. Queda registrado en la auditoría: quién lo hizo y sobre quién.
        </p>
      </form>
    </section>
  )
}
