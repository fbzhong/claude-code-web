#!/bin/bash

# Claude Code Web Production Deployment Script
# Automated deployment of Claude Code Web to production environment

set -e

SCRIPT_DIR="$(dirname "$0")"

echo "🚀 Starting Claude Code Web deployment..."
echo ""

# Check if .env exists for production
if [ ! -f .env.prod ]; then
    echo "❌ Error: .env.prod file not found!"
    echo ""
    echo "📋 Please create .env.prod with your configuration:"
    echo ""
    echo "Option 1 - Copy from example:"
    echo "  cp .env.example .env.prod"
    echo "  vim .env.prod"
    echo ""
    echo "Option 2 - Use environment template:"
    if [ -f .env.production.example ]; then
        echo "  cp .env.production.example .env.prod"
        echo "  vim .env.prod"
    fi
    echo ""
    echo "🔑 Required variables to configure:"
    echo "  - DATABASE_PASSWORD (generate: openssl rand -hex 32)"
    echo "  - JWT_SECRET (generate: openssl rand -hex 32)"
    echo "  - ENCRYPTION_KEY (generate: openssl rand -hex 32)"
    echo "  Note: GitHub OAuth and other settings are now managed via dynamic configuration"
    echo ""
    exit 1
fi

echo "✅ Found .env.prod configuration file"

# Load environment variables
echo "📖 Loading environment variables..."
export $(cat .env.prod | grep -v '^#' | xargs)

# Create necessary directories
echo "📁 Creating necessary directories..."
SSHPIPER_DIR=${SSHPIPER:-./sshpiper}
DATABASE_DIR=${DATABASE:-./data/postgres}

# Create directory structure
mkdir -p "$SSHPIPER_DIR/workingdir"
mkdir -p "$SSHPIPER_DIR/hostkeys"
mkdir -p "$DATABASE_DIR"

# Set proper permissions
chmod 755 "$SSHPIPER_DIR"
chmod 755 "$SSHPIPER_DIR/workingdir"
chmod 755 "$SSHPIPER_DIR/hostkeys"
chmod 755 "$(dirname "$DATABASE_DIR")" 2>/dev/null || true

echo "✅ Directories created successfully"

# Generate SSH keys
echo "🔐 Setting up SSH keys..."

# Generate SSHpiper upstream key if not exists
UPSTREAM_KEY="$SSHPIPER_DIR/sshpiper_id_rsa"
if [ ! -f "$UPSTREAM_KEY" ]; then
    echo "   Generating SSHpiper upstream key..."
    ssh-keygen -t rsa -b 4096 -f "$UPSTREAM_KEY" -N "" -C "sshpiper@claude-web"
    chmod 600 "$UPSTREAM_KEY"
    chmod 644 "${UPSTREAM_KEY}.pub"
fi

# Generate SSH host key for SSHpiper if not exists
HOSTKEY_PATH="$SSHPIPER_DIR/hostkeys/ssh_host_ed25519_key"
if [ ! -f "$HOSTKEY_PATH" ]; then
    echo "   Generating SSHpiper host key..."
    ssh-keygen -t ed25519 -f "$HOSTKEY_PATH" -N ""
    chmod 600 "$HOSTKEY_PATH"
    chmod 644 "${HOSTKEY_PATH}.pub"
fi

echo "✅ SSH keys configured"

# Create Docker network
echo "🌐 Setting up Docker network..."
NETWORK_NAME="claude-web-bridge"
if ! docker network ls | grep -q "$NETWORK_NAME"; then
    docker network create "$NETWORK_NAME" --driver bridge
    echo "✅ Created Docker network: $NETWORK_NAME"
else
    echo "✅ Docker network already exists: $NETWORK_NAME"
fi

# Check if development container image exists
echo "🔨 Checking development container image..."
if ! docker image inspect claude-web-dev:latest >/dev/null 2>&1; then
    echo "   Development container image not found. Building..."
    if [ -f "${SCRIPT_DIR}/scripts/rebuild-dev-image.sh" ]; then
        "${SCRIPT_DIR}/scripts/rebuild-dev-image.sh"
    elif [ -f "docker/dev/Dockerfile" ]; then
        echo "   Building development image from docker/dev/Dockerfile..."
        docker build -t claude-web-dev:latest -f docker/dev/Dockerfile .
    else
        echo "⚠️  Warning: No development container found, skipping..."
    fi
else
    echo "✅ Development container image already exists"
fi

# Build all services
echo "🏗️  Building all services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# Start services
echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo "📊 Checking service status..."
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Health check for critical services
echo "🔍 Performing health checks..."
API_PORT=${API_PORT:-12021}
WEB_PORT=${WEB_PORT:-12020}

# Check backend health
for i in {1..30}; do
    if curl -s "http://localhost:$API_PORT/health" >/dev/null 2>&1; then
        echo "✅ Backend service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Warning: Backend health check failed"
    else
        echo "   Waiting for backend... ($i/30)"
        sleep 2
    fi
done

# Check frontend
if curl -s "http://localhost:$WEB_PORT/" >/dev/null 2>&1; then
    echo "✅ Frontend service is healthy"
else
    echo "⚠️  Warning: Frontend service may not be ready yet"
fi

# Create initial invite codes (first deployment only)
echo "🎟️  Creating initial invite codes..."
sleep 5  # Wait for backend to be fully ready
if docker exec claude-web-backend npm run invite:create -- --count 5 --prefix LAUNCH 2>/dev/null; then
    echo "✅ Initial invite codes created"
    echo "   Use 'docker exec claude-web-backend npm run invite:list' to view them"
else
    echo "⚠️  Failed to create invite codes automatically (may already exist)"
    echo "   Create manually if needed: docker exec claude-web-backend npm run invite:create"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "==========================================="
echo "           Claude Code Web is Ready!"
echo "==========================================="
echo ""
echo "🌐 Access Points:"
echo "   • Frontend:    http://localhost:${WEB_PORT:-12020}"
echo "   • Backend API: http://localhost:${API_PORT:-12021}"
echo "   • SSH Access:  ssh user@localhost -p ${SSHPIPER_SSH_PORT:-2222}"
echo ""
echo "📋 Next Steps:"
echo "   1. Configure reverse proxy (nginx/caddy) for HTTPS"
echo "   2. Update DNS records to point to your server"
echo "   3. Configure system settings (GitHub OAuth, container mode, etc.)"
echo ""
echo "🔧 Management Commands:"
echo "   • View logs:        docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f"
echo "   • Stop services:    docker compose -f docker-compose.prod.yml --env-file .env.prod down"
echo "   • Restart services: docker compose -f docker-compose.prod.yml --env-file .env.prod restart"
echo "   • Update services:  git pull && ./deploy.sh"
echo ""
echo "🎟️  Invite Code Management:"
echo "   • Create codes:     docker exec claude-web-backend npm run invite:create"
echo "   • List codes:       docker exec claude-web-backend npm run invite:list"
echo "   • Delete code:      docker exec claude-web-backend npm run invite:delete <code>"
echo ""
echo "⚙️  System Configuration:"
echo "   • View settings:    docker exec claude-web-backend npm run config:list"
echo "   • Set value:        docker exec claude-web-backend npm run config:set <key> <value>"
echo "   • Get value:        docker exec claude-web-backend npm run config:get <key>"
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
echo ""

# Configuration management info
echo "⚙️  Configuration Management:"
echo "   • View all settings:  docker exec claude-web-backend npm run config:list"
echo "   • Set a value:        docker exec claude-web-backend npm run config:set <key> <value>"
echo "   • Common settings:"
echo "     - require_invite_code (true/false)"
echo "     - container_mode (true/false)"
echo "     - github_client_id, github_client_secret"
echo ""

echo "📖 Documentation:"
echo "   • Project docs: https://github.com/fbzhong/claude-web"
echo "   • Report issues: https://github.com/fbzhong/claude-web/issues"
echo ""
echo "✨ Happy coding with Claude Code Web!"
