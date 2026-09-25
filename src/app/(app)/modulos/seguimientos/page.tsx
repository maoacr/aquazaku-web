import { ClientesParaLlamar } from '@/components/clientes/para-llamar'
import {
  PestanasDeSeguimientos,
  canalDesde,
} from '@/components/clientes/pestanas-de-seguimientos'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Producto, ResumenDeStock, SeguimientosALlamar } from '@/lib/api-types'

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
 * La mudanza arregló las dos cosas: el tablero volvió a tener una cabecera
 * liviana, y esta pantalla es la que se recorre cuando alguien se sienta a
 * marcar.
 *
 * ── Qué se replanteó después ────────────────────────────────────────────────
 *
 * Dos cosas, las dos por la misma razón: la lista mentía por omisión.
 *
 *   1. **La fila es la dirección, no el cliente.** El agua se entrega a una
 *      puerta. Un cliente con casa y local tenía un solo contador —el más
 *      reciente de los dos— así que el local podía llevar veinte días seco
 *      detrás de una casa que pidió ayer.
 *   2. **Dos canales.** Un botellón se acaba en una semana; una paca de
 *      ochenta bolsas no. Un contador mezclado no servía para ninguno.
 *
 * El detalle de las dos reglas vive en `api/src/modules/clientes/a-llamar.ts`,
 * que es donde está la cuenta. Acá solo se elige la pestaña y se pinta.
 *
 * ── La pestaña vive en la URL ───────────────────────────────────────────────
 *
 * `?canal=otros`, no un `useState`. Eso deja la pantalla como Server Component
 * —cero JavaScript para algo que es navegación— y permite refrescar o compartir
 * el link sin perder el lugar. Es el mismo criterio que `?tab=` en Ventas, y
 * ahora comparten el componente.
 *
 * ── Una sola petición para las dos pestañas ─────────────────────────────────
 *
 * `api` contesta los dos canales juntos. La cabecera muestra el conteo de las
 * dos antes de que nadie toque ninguna, así que pedirlas por separado sería un
 * viaje para pintar un número que ya venía en el primero.
 */
export default async function SeguimientosPage({
  searchParams,
}: {
  searchParams?: Promise<{ canal?: string }>
}) {
  const sp = searchParams ? await searchParams : undefined
  const canal = canalDesde(sp?.canal)

  /*
   * El catálogo y el stock viajan con la pantalla porque el lápiz de cada fila
   * abre el MOSTRADOR de Ventas, precargado con la venta a corregir — y el
   * mostrador los necesita para el carrito, el piso de precio y el aviso de
   * stock. Pedirlos al abrir el modal metería una espera en el momento en que
   * alguien ya decidió actuar.
   */
  const [seguimientos, productos, stock] = await Promise.all([
    apiServerFetch<SeguimientosALlamar>('/clientes/a-llamar'),
    apiServerFetch<Producto[]>('/productos'),
    apiServerFetch<ResumenDeStock[]>('/stock'),
  ])
  const leidoEn = new Date()

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Seguimientos</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Qué dirección lleva varios días sin recibir. Una llamada a tiempo evita que se cambie de
          planta.
        </p>
      </header>

      <PestanasDeSeguimientos
        canal={canal}
        conteos={{
          botellones: seguimientos.botellones.length,
          otros: seguimientos.otros.length,
        }}
        basePath="/modulos/seguimientos"
      />

      <ClientesParaLlamar
        filas={seguimientos[canal]}
        canal={canal}
        productos={productos}
        stock={stock}
      />
      <SelloDeHora leidoEn={leidoEn} />
    </div>
  )
}
