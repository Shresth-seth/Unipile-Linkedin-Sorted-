# Multi-stage production Dockerfile for WorkPilot Express backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and config
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

# Build TypeScript to dist
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts from builder with proper ownership
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/src/db/migrations ./src/db/migrations

# Expose backend API port
EXPOSE 4000

# Switch to non-root user
USER expressjs

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/api/health/liveness || exit 1

# Start the application
CMD ["node", "dist/index.js"]
