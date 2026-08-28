# Aquazaku · web
#
# ── Por qué NO usa `output: 'standalone'` ───────────────────────────────────
#
# `standalone` es la forma recomendada y produce una imagen mucho más chica: un
# servidor con solo los módulos que el runtime usa de verdad. Se intentó, y no
# funciona con la estructura de `node_modules` que arma pnpm.
#
# El trazador copió de `@swc/helpers` únicamente el directorio `cjs/`, y el
# `require-hook` de Next resuelve el camino ESM. La imagen se construye sin una
# queja y el servidor muere al arrancar:
#
#   Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'
#
# `--node-linker=hoisted` tampoco alcanza: pnpm mantiene el almacén virtual en
# `.pnpm` y el trazador sigue resolviendo por ahí. Ir copiando a mano los
# directorios que falten es jugar a las escondidas con una lista que cambia con
# cada dependencia.
#
# Se copia `node_modules` entero y se corre `next start`. La imagen pesa unos
# cientos de megas más, y para un servidor que atiende a ocho personas eso es
# una descarga única contra una clase entera de fallos que solo aparecen en
# producción.
#
# ── Las variables NO se hornean en la imagen ────────────────────────────────
#
# `API_INTERNAL_URL` y `WEB_PUBLIC_URL` se leen en cada pedido desde los Server
# Components, así que van como entorno del contenedor. Meterlas en el build
# ataría la imagen a un ambiente y obligaría a reconstruirla para cambiar de
# servidor.

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app
# `pnpm-workspace.yaml` va sí o sí: es donde vive `allowBuilds`, y sin él pnpm
# rechaza los postinstall de msw y del resolvedor del lint, y el install falla.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
# Se invoca el binario directo, sin pnpm. `pnpm start` dispara un chequeo del
# estado de las dependencias que abre un subproceso y falla en un contenedor sin
# el árbol de trabajo completo — un fallo de la herramienta de desarrollo, no de
# la aplicación, y que solo aparece al arrancar.
CMD ["node_modules/.bin/next", "start"]
