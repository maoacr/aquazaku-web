# Aquazaku · web
#
# Tres etapas, y cada una existe por una razón concreta.
#
# ── 1. deps ─────────────────────────────────────────────────────────────────
#
# Instala TODO, incluidas las dependencias de desarrollo: `next build` necesita
# TypeScript y Tailwind. Va en su propia capa porque el lockfile casi nunca
# cambia y el código sí — sin esta separación cada deploy reinstala de cero.
#
# ── 2. build ────────────────────────────────────────────────────────────────
#
# `output: 'standalone'` deja en `.next/standalone` un servidor con solo los
# módulos que el runtime usa de verdad.
#
# ── 3. runtime ──────────────────────────────────────────────────────────────
#
# No instala `node_modules`: copia lo que la etapa anterior ya resolvió. Y
# copia `public` y `.next/static` A MANO, porque `standalone` NO los incluye:
# asume que los sirve un CDN. Acá no hay CDN. Sin ese paso la app levanta y
# responde, pero sin estilos ni fuentes — un fallo que parece de CSS y es de
# empaquetado.
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
COPY package.json pnpm-lock.yaml ./
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

# El servidor mínimo que genera `standalone`, con sus dependencias adentro.
COPY --from=build --chown=node:node /app/.next/standalone ./
# Lo que `standalone` deja afuera a propósito.
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
