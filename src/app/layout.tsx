import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
