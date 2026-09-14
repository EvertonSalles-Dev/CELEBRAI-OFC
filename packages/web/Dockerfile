# ============================================================================
# Celebrai Web — build estático + Nginx
# ============================================================================

# ---------------------------------------------------------------------------
# Estágio 1 — build do bundle
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/web/package.json ./packages/web/

RUN npm ci --ignore-scripts --workspace @celebrai/web --include-workspace-root

COPY packages/web ./packages/web
WORKDIR /app/packages/web

# A URL da API é embutida no bundle em tempo de build.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npx tsc --noEmit && npx vite build

# ---------------------------------------------------------------------------
# Estágio 2 — Nginx servindo os arquivos estáticos
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Configuração própria: SPA fallback, cache de assets, gzip e headers de segurança.
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/packages/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
