import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { atributoDeTema, leerTema } from '@/lib/tema'
import './globals.css'

/**
 * IBM Plex, del sistema de diseño.
 *
 * Elegidas porque la «1», la «l» y la «I» son inequívocas. Importa cuando
 * alguien lee un ID de base al sol, o un código de lote impreso en una bolsa.
 *
 * Los pesos se declaran explícitos: el sistema usa 400/500/600/700 en la sans y
 * 400/500/600 en la mono, y pedir la familia entera manda al browser fuentes
 * que ninguna pantalla usa.
 */
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Aquazaku',
  description: 'Sistema de gestión de Aquazaku: ventas, stock, clientes y proveedores.',
}

/**
 * El tema se resuelve **en el servidor**, antes de mandar el HTML.
 *
 * ── Por qué no en el cliente ────────────────────────────────────────────────
 *
 * Leer la preferencia con JavaScript y aplicarla al montar produce un destello
 * blanco: el browser ya pintó la página en claro cuando el script corre. Ese
 * destello es la razón por la que tantas implementaciones de modo oscuro se
 * sienten baratas.
 *
 * Con la preferencia en una cookie, el atributo viaja en el HTML inicial y la
 * primera pintura ya es la correcta. No hace falta script de bloqueo ni
 * `suppressHydrationWarning`.
 */
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const tema = await leerTema()

  return (
    <html
      lang="es"
      {...atributoDeTema(tema)}
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
