import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * ── Salida autocontenida, para la imagen de producción ────────────────────
   *
   * `standalone` deja en `.next/standalone` un servidor con SOLO los módulos
   * que el runtime usa de verdad. La imagen final no instala `node_modules`:
   * pasa de cientos de megas a decenas.
   *
   * Los docs de esta versión avisan de una trampa: `public/` y `.next/static`
   * NO se copian solos, porque asumen que los sirve un CDN. Acá no hay CDN
   * —una planta con ocho personas— así que el Dockerfile los copia a mano. Sin
   * eso la app levanta y responde, pero sin estilos ni fuentes: un fallo que
   * parece de CSS y es de empaquetado.
   */
  output: 'standalone',
}

export default nextConfig
