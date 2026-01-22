# Stage 1: build
FROM node:20-alpine AS builder
# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.2.0 --activate
WORKDIR /app
# Copy package files first
COPY package.json pnpm-lock.yaml ./
# Copy Prisma schema before install (needed for postinstall script)
COPY prisma ./prisma
# Install dependencies (postinstall will run prisma generate)
RUN pnpm install --frozen-lockfile
# Copy rest of the application
COPY . .
RUN pnpm run build

# Stage 2: runtime
FROM node:20-alpine
# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.2.0 --activate
WORKDIR /app
# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
# Copy Prisma schema (needed for postinstall script to generate Prisma Client)
COPY --from=builder /app/prisma ./prisma
# Install production dependencies (postinstall will run prisma generate)
# Install production dependencies WITHOUT running postinstall scripts (which would trigger latest prisma)
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
# Generate Prisma client with pinned version (avoids Prisma 7 breaking changes)
RUN npx prisma@6 generate
# Copy built application
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/main"]
