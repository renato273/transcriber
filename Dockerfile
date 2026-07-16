# ──────────────────────────────────────────────
# AI Transcriber — production image (pnpm monorepo)
# ──────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── prune: subgrafo de @transcriber/web ──
FROM base AS pruner
RUN npm install -g turbo@1.13.4
COPY . .
RUN turbo prune @transcriber/web --docker

# ── deps ──
FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── build ──
FROM base AS builder
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
# Dummy URL solo para `prisma generate` (no conecta a DB)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN pnpm --filter @transcriber/database db:generate \
  && pnpm exec turbo run build --filter=@transcriber/web

# ── runner ──
FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV AUDIO_STORAGE_PATH=/app/storage/audio

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 astro

COPY --from=builder --chown=astro:nodejs /app/package.json ./
COPY --from=builder --chown=astro:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=astro:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=astro:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=astro:nodejs /app/apps ./apps
COPY --from=builder --chown=astro:nodejs /app/packages ./packages

COPY --chown=astro:nodejs docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && mkdir -p /app/storage/audio \
  && chown -R astro:nodejs /app/storage

USER astro
EXPOSE 4321
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/web/dist/server/entry.mjs"]
