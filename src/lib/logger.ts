/**
 * Logger estructurado de web/.
 *
 * Emite JSON con la MISMA forma que Pino en api/ (`level` numérico, `time`,
 * `msg`) para que una sola query sobre los dos streams de logs correlacione
 * ambos lados de un request vía `requestId`. Si acá se logueara texto plano,
 * el tracing distribuido se cortaría justo en la frontera web/ → api/.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogFields {
  [key: string]: unknown
}

/** Niveles numéricos de Pino. Mismos números = mismos filtros en el dashboard. */
const PINO_LEVELS: Record<LogLevel, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
}

function write(level: LogLevel, fields: LogFields, msg: string): void {
  const line = JSON.stringify({
    level: PINO_LEVELS[level],
    time: Date.now(),
    name: 'web',
    ...fields,
    msg,
  })

  // warn y error van a stderr, como Pino. Así un `pnpm start 2> errores.log`
  // separa lo accionable del ruido sin necesidad de filtrar.
  if (level === 'warn' || level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug: (fields: LogFields, msg: string): void => write('debug', fields, msg),
  info: (fields: LogFields, msg: string): void => write('info', fields, msg),
  warn: (fields: LogFields, msg: string): void => write('warn', fields, msg),
  error: (fields: LogFields, msg: string): void => write('error', fields, msg),
}
