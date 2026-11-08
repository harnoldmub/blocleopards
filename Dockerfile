# syntax=docker/dockerfile:1

# ── 1. Étape de Build ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Arguments de build (transmis par Railway)
ARG DATABASE_URL
ARG ADMIN_PASSWORD
ARG ADMIN_SESSION_TOKEN
ARG PUBLIC_SANITY_PROJECT_ID
ARG PUBLIC_SANITY_DATASET
ARG PUBLIC_TURNSTILE_SITE_KEY
ARG TURNSTILE_SECRET_KEY
ARG RESEND_API_KEY
ARG EMAIL_FROM
ARG API_FOOTBALL_KEY
ARG S3_ENDPOINT
ARG S3_REGION
ARG S3_BUCKET
ARG S3_ACCESS_KEY_ID
ARG S3_SECRET_ACCESS_KEY

# Injection des variables publiques pour le build Astro/Vite
ENV DATABASE_URL=$DATABASE_URL
ENV PUBLIC_SANITY_PROJECT_ID=$PUBLIC_SANITY_PROJECT_ID
ENV PUBLIC_SANITY_DATASET=$PUBLIC_SANITY_DATASET
ENV PUBLIC_TURNSTILE_SITE_KEY=$PUBLIC_TURNSTILE_SITE_KEY

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

# ── 2. Étape d'Exécution (Production) ────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
RUN mkdir -p /app/private

EXPOSE 5000

CMD ["node", "./dist/server/entry.mjs"]
