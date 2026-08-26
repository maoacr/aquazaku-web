import { VistaDeAuditoria } from '@/components/auditoria/vista-auditoria'
import { unoSolo } from '@/lib/query'

/** Auditoría. La ven `admin` y `contador`; qué filas trae cada uno lo decide `api/`. */
export default async function AuditoriaPage({ searchParams }: PageProps<'/modulos/auditoria'>) {
  const params = await searchParams

  return (
    <VistaDeAuditoria
      ruta="/modulos/auditoria"
      filtros={{
        action: unoSolo(params.action),
        resource: unoSolo(params.resource),
        result: unoSolo(params.result),
        userId: unoSolo(params.userId),
        desde: unoSolo(params.desde),
        hasta: unoSolo(params.hasta),
        cursor: unoSolo(params.cursor),
      }}
    />
  )
}
