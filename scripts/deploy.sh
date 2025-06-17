#!/bin/bash

# Claude Web Production Deployment Script

set -e

SCRIPT_DIR="$(dirname "$0")"

echo "🚀 Starting Claude Web deployment..."

# Check if .env exists for production
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.production.example to .env and fill in the values."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Create necessary directories
echo "📁 Creating necessary directories..."
# Use configured base directory or default
SSHPIPER_DIR=${SSHPIPER_DIR:-./sshpiper}

# Create subdirectories
mkdir -p "$SSHPIPER_DIR/workingdir"
mkdir -p "$SSHPIPER_DIR/hostkeys"

# Generate SSHpiper key if not exists
UPSTREAM_KEY="$SSHPIPER_DIR/sshpiper_id_rsa"
if [ ! -f "$UPSTREAM_KEY" ]; then
    echo "🔐 Generating SSHpiper key..."
    ssh-keygen -t rsa -b 4096 -f "$UPSTREAM_KEY" -N "" -C "sshpiper@claude-web"
fi

# Set proper permissions
chmod 600 "$UPSTREAM_KEY"
chmod 644 "${UPSTREAM_KEY}.pub"

# Ensure directories have correct permissions
chmod 755 "$SSHPIPER_DIR"
chmod 755 "$SSHPIPER_DIR/workingdir"
chmod 755 "$SSHPIPER_DIR/hostkeys"

# Generate SSH host key for SSHpiper if not exists
HOSTKEY_PATH="$SSHPIPER_DIR/hostkeys/ssh_host_ed25519_key"
if [ ! -f "$HOSTKEY_PATH" ]; then
    echo "🔐 Generating SSHpiper host key..."
    ssh-keygen -t ed25519 -f "$HOSTKEY_PATH" -N ""
    chmod 600 "$HOSTKEY_PATH"
    chmod 644 "${HOSTKEY_PATH}.pub"
fi

# Check if development container image exists
if ! docker image inspect claude-web-dev:latest >/dev/null 2>&1; then
    echo "🔨 Development container image not found. Building..."
    "${SCRIPT_DIR}/rebuild-dev-image.sh"
else
    echo "✓ Development container image already exists"
fi

# Pull/Build all images
echo "🏗️ Building all services..."
docker compose -f docker-compose.prod.yml build

# Start services
echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo "📊 Checking service status..."
docker compose -f docker-compose.prod.yml ps

# Create initial invite codes if enabled
if [ "$REQUIRE_INVITE_CODE" = "true" ]; then
    echo "🎟️ Creating initial invite codes..."
    sleep 5  # Wait for backend to be fully ready
    docker exec claude-web-backend npm run invite:create -- --count 5 --prefix LAUNCH
fi

echo "✅ Deployment complete!"
echo ""
echo "🌐 Access points:"
echo "   - Frontend: http://localhost:12020"
echo "   - Backend API: http://localhost:12021"
echo "   - SSH: ssh user@localhost -p 2222"
echo ""
echo "📝 Next steps:"
echo "   1. Configure your reverse proxy (nginx/caddy) for HTTPS"
echo "   2. Update DNS records to point to your server"
echo "   3. Monitor logs: docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🔧 Management commands:"
echo "   - View logs: docker compose -f docker-compose.prod.yml logs -f"
echo "   - Stop services: docker compose -f docker-compose.prod.yml down"
echo "   - Update services: git pull && ./scripts/deploy.sh"
echo "   - Create invite codes: docker exec claude-web-backend npm run invite:create"
