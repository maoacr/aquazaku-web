/**
 * Dashboard. Vive en `/` porque `(app)` es un route group y no agrega segmento.
 *
 * Reemplaza a la landing provisoria que ocupaba esta ruta durante el bootstrap:
 * dos `page` resolviendo al mismo path es un error de build en Next.
 */
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-tenue">Bienvenido a Aquazaku.</p>
    </div>
  )
}
