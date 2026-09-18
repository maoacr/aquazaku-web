import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],

    /*
     * Los tests corren en UTC porque ahí corre PRODUCCIÓN.
     *
     * El contenedor no define `TZ`, así que Node arranca en UTC. Una Mac
     * colombiana está en `America/Bogota`, y ahí un formateo sin `timeZone`
     * acierta por accidente: el test que debería atajar el bug pasa en verde y
     * el bug viaja igual.
     *
     * Es la misma decisión que `api/src/lib/__tests__/dia.test.ts`, que pone la
     * SESIÓN de Postgres en UTC por la misma razón — y ese bug lo encontró el
     * CI, que también corre en UTC, no una lectura del código.
     */
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/app/**/layout.tsx', 'src/app/**/globals.css'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        // El helper BFF y el cálculo de módulos visibles son las dos piezas
        // donde un bug se traduce en fuga de datos o de permisos (spec §12).
        'src/lib/api-server.ts': { lines: 90, functions: 90, branches: 85 },
        'src/lib/modules.ts': { lines: 90, functions: 90, branches: 85 },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
