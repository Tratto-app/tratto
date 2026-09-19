# Imagen de producción. Funciona tal cual en Render, Railway, Fly.io,
# Google Cloud Run o cualquier VPS con Docker.

# ── Etapa 1: dependencias y compilación ──────────────────────────────────────
FROM node:22-bookworm-slim AS build

# better-sqlite3 trae binarios precompilados; estas herramientas están por si
# la plataforma no tiene uno y hay que compilarlo desde el fuente.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ── Etapa 2: imagen final ────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# No correr como root.
RUN useradd --system --create-home --uid 10001 barberia

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY config ./config
COPY public ./public

# Carpeta de datos (solo se usa con SQLite; en producción se recomienda Postgres).
RUN mkdir -p /app/data && chown -R barberia:barberia /app

USER barberia
EXPOSE 3000

# El healthcheck usa el endpoint /salud del propio servicio.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
