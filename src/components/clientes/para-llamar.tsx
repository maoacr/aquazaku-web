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
 * ── El número de días es el contenido, no un adorno ─────────────────────────
 *
 * La primera versión lo escondía en prosa —«Urgente · 30 días sin comprar»— con
 * el mismo peso que todo lo demás. Pero ese número **es** la pregunta que la
 * lista contesta: a quién llamar cuando no hay tiempo de llamar a todos.
 *
 * Por eso vive en una columna propia a la izquierda, grande y en cifra tabular.
 * Así la lista se lee hacia abajo —30, 15, 15, 12, 8, 7, 6, 5— que es cómo
 * alguien tría llamadas de verdad: mirando la columna, no leyendo ocho frases.
 *
 * ── Cada teléfono es su propia línea ────────────────────────────────────────
 *
 * La primera versión los ponía en fila, y con dos números el botón quedaba
 * ENTRE los dos: no se sabía a cuál pertenecía. Un botón ambiguo en una
 * pantalla que manda mensajes con el nombre del cliente adentro no es un
 * detalle estético.
 *
 * ── Server Component, sin estado ────────────────────────────────────────────
 *
 * No hay `'use client'`. Los enlaces son `<a href>` y el número viene armado
 * desde `api`: no hay nada que calcular en el navegador.
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
          Un botellón de casa dura alrededor de una semana. Estos clientes ya pasaron ese punto
          {urgentes > 0 ? `, y ${urgentes} hace rato que están sin agua` : ''}.
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
      className={`relative flex items-stretch gap-4 rounded-lg border p-3 transition-colors ${
        urgente
          ? 'border-error-borde bg-error-fondo text-error-texto hover:border-error'
          : 'border-alerta-borde bg-alerta-fondo text-alerta-texto hover:border-alerta'
      }`}
    >
      <Contador dias={cliente.diasSinComprar} urgente={urgente} />

      <div className="grid min-w-0 flex-1 content-start gap-2">
        {/*
          ── El nombre es el enlace, y su sombra cubre la tarjeta ──────────────

          La lista dice a quién llamar; la ficha dice qué decirle. Sin ese salto,
          quien atiende tiene que ir a Clientes y buscar el nombre a mano, con el
          teléfono ya sonando.

          No se envuelve la tarjeta entera en un `Link` porque **un `<a>` no
          puede contener otro `<a>`**, y acá adentro viven los de WhatsApp. El
          `after:absolute after:inset-0` estira el área clicable sin anidar nada:
          un solo enlace real por destino, y el lector de pantalla anuncia el
          nombre, no «tarjeta, clicable».

          El nombre ENVUELVE, no se corta: «Mario Alejandro Cre…» obliga a abrir
          la ficha para saber a quién se llama, que es justo lo que este enlace
          viene a evitar.
        */}
        <Link
          href={`/modulos/clientes/${cliente.clienteId}`}
          className="font-semibold leading-tight break-words underline-offset-4 after:absolute after:inset-0 after:rounded-lg hover:underline"
        >
          {cliente.nombre}
        </Link>

        {cliente.telefonos.length === 0 ? (
          /*
           * La ausencia se marca COMO ausencia: en cursiva y sin cifra tabular,
           * para que no compita con los números reales de las otras filas. Y
           * aparece igual, porque «no hay a quién llamar» es accionable —
           * alguien tiene que ir a cargar ese número.
           */
          <p className="flex items-center gap-1.5 text-[13px] italic opacity-75">
            <PhoneOff aria-hidden className="size-3.5 shrink-0" />
            Sin teléfono cargado
          </p>
        ) : (
          <ul className="grid gap-1">
            {cliente.telefonos.map((t) => (
              <Telefono key={t.numero} telefono={t} nombre={cliente.nombre} />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

/**
 * La columna que hace escaneable la lista.
 *
 * `aq-cifra` es tabular: un `30` y un `8` ocupan lo mismo, así que la columna no
 * baila y se puede recorrer con el ojo sin leer. Es la diferencia entre triar
 * una lista y leer ocho frases.
 *
 * La palabra «urgente» va acá y no en la prosa: una diferencia que viva solo en
 * el color no la ve quien no distingue rojo de ámbar, y esta pantalla se mira
 * de reojo entre cliente y cliente.
 */
function Contador({ dias, urgente }: { dias: number; urgente: boolean }) {
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r border-current/20 pr-3 text-center">
      <span className="aq-cifra text-[28px] font-semibold leading-none">{dias}</span>
      <span className="aq-micro mt-1 opacity-75">{dias === 1 ? 'día' : 'días'}</span>
      {urgente ? <span className="aq-micro mt-1.5 font-semibold">URGENTE</span> : null}
    </div>
  )
}

function Telefono({ telefono, nombre }: { telefono: TelefonoParaLlamar; nombre: string }) {
  return (
    /*
     * ── Cada teléfono es un BLOQUE, no una línea ─────────────────────────────
     *
     * Dos versiones fallaron antes de esta, y las dos por lo mismo:
     *
     *   1. Todos los números en una fila → con dos teléfonos, el botón quedaba
     *      entre ambos y no se sabía a cuál pertenecía.
     *   2. Un número por línea con el botón empujado al final → en escritorio
     *      quedó bien, pero al angostar la pantalla el botón envuelve y cae
     *      encima del número SIGUIENTE. El mismo bug, escondido hasta el móvil.
     *
     * El fondo tenue es lo que lo resuelve en todo ancho: si el botón envuelve,
     * envuelve DENTRO de su bloque. La pertenencia deja de depender de que haya
     * espacio.
     */
    /*
     * `relative z-10` lo pone POR ENCIMA de la sombra del enlace a la ficha.
     * Sin eso pasan dos cosas malas y ninguna falla ruidosamente: el botón de
     * WhatsApp navega a la ficha —y quien atiende cree que WhatsApp se rompió—
     * y el número deja de poder seleccionarse para copiarlo a un teléfono de
     * escritorio, que es exactamente lo que alguien hace con esta lista.
     */
    <li className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-current/5 px-2 py-1.5">
      <span className="aq-cifra text-[13px]">{telefono.numero}</span>

      {telefono.etiqueta ? (
        /*
         * La etiqueta acompaña, no compite: fuera de la cifra tabular y más
         * callada. Sirve para elegir a cuál llamar —«el celular del dueño»—, no
         * para leerla primero.
         */
        <span className="text-[12px] opacity-70">{telefono.etiqueta}</span>
      ) : null}

      {/*
        El botón SOLO cuando hay a dónde ir.

        `wa.me` con un fijo abre WhatsApp y contesta que ese número no existe.
        Un botón que a veces lleva a una pared obliga a comprobar cada vez, y
        termina siendo un botón en el que nadie confía. `api` ya decidió: manda
        `whatsapp: null` cuando no se puede.

        `ml-auto` lo empuja al final de SU línea, así que los botones quedan
        alineados entre sí aunque los números tengan largos distintos.
      */}
      {telefono.whatsapp ? (
        <Link
          href={`https://wa.me/${telefono.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribir por WhatsApp a ${nombre} al ${telefono.numero}`}
          className="aq-boton aq-boton-secundario aq-boton-compacto ml-auto"
        >
          <MessageCircle aria-hidden className="size-4" />
          WhatsApp
        </Link>
      ) : null}
    </li>
  )
}
