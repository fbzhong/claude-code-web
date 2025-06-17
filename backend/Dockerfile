# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install system dependencies for building native modules (node-pty)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Install all dependencies (including dev dependencies for building)
RUN pnpm install --frozen-lockfile --unsafe-perm \
 && pnpm rebuild --unsafe-perm

# Copy source code
COPY src/ ./src/

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy built application first
COPY --from=builder /app/dist ./dist

# Copy all node_modules from builder (including compiled native modules)
# This avoids recompilation and ensures all modules work correctly
COPY --from=builder /app/node_modules ./node_modules

# Note: Running as root is required for:
# - Docker socket access (/var/run/docker.sock)
# - Managing SSHpiper workingdir files
# - Creating and managing user containers

# Expose port
EXPOSE 12021

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:12021/api/health || exit 1

# Start the application
CMD ["pnpm", "start"]
