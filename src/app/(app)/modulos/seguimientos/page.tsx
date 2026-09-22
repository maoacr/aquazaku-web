import { ClientesParaLlamar } from '@/components/clientes/para-llamar'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { ClienteALlamar } from '@/lib/api-types'

/**
 * Seguimientos — M15.
 *
 * ── Por qué tiene su propia pantalla ────────────────────────────────────────
 *
 * Esta lista arrancó como una sección del tablero. El problema no era el
 * contenido: era el PESO. La lista completa —días sin comprar, teléfonos
 * con su etiqueta, botón de WhatsApp, dos franjas según la urgencia—
 * arriba de los gráficos le ganaba al resto y el tablero dejaba de leerse
 * como «qué hacer / cómo venimos»: se leía como «llamar a Yeimy».
 *
 * La mudanza arregla las dos cosas: el tablero vuelve a tener una
 * cabecera liviana, y esta pantalla es la que se recorre cuando alguien
 * se sienta a marcar.
 *
 * ── Toda la lógica es la de antes ──────────────────────────────────────────
 *
 * El componente `ClientesParaLlamar`, el endpoint `/clientes/a-llamar`, la
 * separación entre «aviso» y «urgente» — nada cambió. Solo cambió el
 * lugar donde se monta. Si un día se agrega, por ejemplo, un canal de
 * seguimiento para clientes con deuda vieja, esta misma pantalla es su
 * casa natural, y el tablero suma otro pendiente más a la lista de
 * arriba.
 *
 * ── Server Component, sin estado ────────────────────────────────────────────
 *
 * No hay `'use client'`. El fetch sale por el BFF (`apiServerFetch`) y la
 * lista se pinta en el servidor. Los enlaces son `<a href>` y los
 * números vienen armados desde `api`: no hay nada que calcular en el
 * navegador.
 */
export default async function SeguimientosPage() {
  const aLlamar = await apiServerFetch<ClienteALlamar[]>('/clientes/a-llamar')
  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Seguimientos</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Quién lleva varios días sin comprar. Una llamada a tiempo evita que se cambie de planta.
        </p>
      </header>

      <ClientesParaLlamar clientes={aLlamar} />
      <SelloDeHora leidoEn={leidoEn} />
    </div>
  )
}