import { MessageCircle, PhoneOff } from 'lucide-react'
import Link from 'next/link'
import type { ClienteALlamar, TelefonoParaLlamar } from '@/lib/api-types'

/**
 * Los clientes para llamar — M15.
 *
 * ── Por qué está en el tablero y no en su propia pantalla ───────────────────
 *
 * Una lista de llamadas en una pantalla aparte es una pantalla que nadie abre.
 * El tablero ya empieza por lo que espera una decisión, y esto es exactamente
 * eso: nombres con un botón al lado.
 *
 * ── Server Component, sin estado ────────────────────────────────────────────
 *
 * No hay `'use client'`. Los enlaces de WhatsApp son `<a href>` y el número
 * viene armado desde `api`: no hay nada que calcular en el navegador.
 */
export function ClientesParaLlamar({ clientes }: { clientes: ClienteALlamar[] }) {
  if (clientes.length === 0) {
    /*
     * La lista vacía se DICE. Una sección que desaparece se lee como una
     * sección rota: quien la vio ayer y hoy no la encuentra no piensa «no hay
     * nadie», piensa «se cayó algo».
     */
    return (
      <section className="aq-tarjeta grid gap-2 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">Para llamar</h2>
        <p className="text-[13px] text-tenue">
          Nadie está atrasado: todos los clientes compraron hace poco. La lista está al día.
        </p>
      </section>
    )
  }

  const urgentes = clientes.filter((c) => c.urgencia === 'urgente').length

  return (
    <section className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Para llamar</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Un botellón de casa dura alrededor de una semana. Estos clientes ya pasaron ese
          punto: {urgentes > 0 ? `${urgentes} sin agua hace rato` : 'todavía a tiempo de ofrecer'}.
        </p>
      </div>

      <ul className="grid gap-2">
        {clientes.map((cliente) => (
          <Fila key={cliente.clienteId} cliente={cliente} />
        ))}
      </ul>
    </section>
  )
}

function Fila({ cliente }: { cliente: ClienteALlamar }) {
  const urgente = cliente.urgencia === 'urgente'

  return (
    /*
     * `aria-label` con el nombre: es lo que hace que cada fila sea
     * identificable, para quien usa lector de pantalla y para los tests. Sin
     * él, «el enlace de WhatsApp de Yeimy» no se puede nombrar.
     */
    <li
      aria-label={cliente.nombre}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
        urgente
          ? 'border-error-borde bg-error-fondo text-error-texto'
          : 'border-alerta-borde bg-alerta-fondo text-alerta-texto'
      }`}
    >
      <div className="grid gap-0.5">
        <span className="font-semibold">{cliente.nombre}</span>
        <span className="text-[13px] opacity-90">
          {/*
            La franja se dice con PALABRAS, no solo con color. Una diferencia
            que vive únicamente en el color no la ve quien no distingue rojo de
            ámbar — y esta pantalla se mira de reojo entre cliente y cliente.
          */}
          {urgente ? 'Urgente · ' : ''}
          {cliente.diasSinComprar} días sin comprar
        </span>
      </div>

      {cliente.telefonos.length === 0 ? (
        /*
         * Aparece igual y dice qué falta. Esconderlo lo dejaría invisible para
         * siempre: nadie sabría que hay un cliente al que no se le puede
         * avisar, que es un dato accionable en sí mismo.
         */
        <span className="flex items-center gap-1.5 text-[13px] opacity-90">
          <PhoneOff aria-hidden className="size-4" />
          Sin teléfono cargado
        </span>
      ) : (
        <ul className="flex flex-wrap items-center gap-2">
          {cliente.telefonos.map((t) => (
            <Telefono key={t.numero} telefono={t} nombre={cliente.nombre} />
          ))}
        </ul>
      )}
    </li>
  )
}

function Telefono({ telefono, nombre }: { telefono: TelefonoParaLlamar; nombre: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="aq-cifra text-[13px]">
        {telefono.numero}
        {telefono.etiqueta ? <span className="ml-1 opacity-75">({telefono.etiqueta})</span> : null}
      </span>

      {/*
        El botón SOLO cuando hay a dónde ir.

        `wa.me` con un fijo abre WhatsApp y contesta que ese número no existe.
        Un botón que a veces lleva a una pared obliga a comprobar cada vez, y
        termina siendo un botón en el que nadie confía. `api` ya decidió: manda
        `whatsapp: null` cuando no se puede.
      */}
      {telefono.whatsapp ? (
        <Link
          href={`https://wa.me/${telefono.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribir por WhatsApp a ${nombre} al ${telefono.numero}`}
          className="aq-boton aq-boton-secundario aq-boton-compacto"
        >
          <MessageCircle aria-hidden className="size-4" />
          WhatsApp
        </Link>
      ) : null}
    </li>
  )
}
