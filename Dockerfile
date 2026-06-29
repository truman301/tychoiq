# TychoIQ production image.
# Uses the full node_modules at runtime so the Prisma CLI (db push on boot) has
# all its dependencies, and starts the app with `next start`. Reliable on
# Railway/Render/Fly/any container host.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the whole built app, including full node_modules (so `prisma` + its deps
# and `next start` are all available at runtime).
COPY --from=builder /app ./

EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
