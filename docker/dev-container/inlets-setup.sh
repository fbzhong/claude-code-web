#!/bin/bash
# Inlets tunnel setup script for Claude Web containers
# This script checks configuration and optionally starts inlets client

set -e

# Configuration
BACKEND_URL="${CLAUDE_WEB_BACKEND_URL:-http://host.docker.internal:12021}"
AUTH_TOKEN="${CLAUDE_WEB_AUTH_TOKEN}"

# Check if we have authentication
if [ -z "$AUTH_TOKEN" ]; then
    echo "No authentication token found, skipping inlets setup"
    exit 0
fi

echo "Checking tunnel configuration..."

# Get tunnel configuration from backend
CONFIG=$(curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
    "${BACKEND_URL}/api/config/tunnels" 2>/dev/null || echo "{}")

# Check if request was successful
if [ -z "$CONFIG" ] || [ "$CONFIG" = "{}" ]; then
    echo "Could not fetch tunnel configuration, skipping inlets setup"
    exit 0
fi

# Parse configuration
TUNNELS_ENABLED=$(echo "$CONFIG" | jq -r '.data.tunnels_enabled // false')
INLETS_SERVER=$(echo "$CONFIG" | jq -r '.data.inlets_server_url // empty')
INLETS_TOKEN=$(echo "$CONFIG" | jq -r '.data.inlets_shared_token // empty')
TUNNEL_BASE_DOMAIN=$(echo "$CONFIG" | jq -r '.data.tunnel_base_domain // empty')

# Check if tunnels are enabled
if [ "$TUNNELS_ENABLED" != "true" ]; then
    echo "Tunnels feature is not enabled"
    exit 0
fi

# Validate configuration
if [ -z "$INLETS_SERVER" ] || [ -z "$INLETS_TOKEN" ] || [ -z "$TUNNEL_BASE_DOMAIN" ]; then
    echo "Tunnel service is not properly configured"
    exit 0
fi

echo "Tunnel configuration loaded successfully"
echo "  Server: $INLETS_SERVER"
echo "  Domain: $TUNNEL_BASE_DOMAIN"

# Create a helper script for users to easily start tunnels
cat > /usr/local/bin/tunnel << 'EOF'
#!/bin/bash
# Claude Web tunnel helper script

if [ -z "$1" ]; then
    echo "Usage: tunnel <port> [protocol]"
    echo "  port     - Local port to expose"
    echo "  protocol - Optional: http (default) or tcp"
    echo ""
    echo "Example:"
    echo "  tunnel 3000      # Expose port 3000 via HTTP"
    echo "  tunnel 5432 tcp  # Expose port 5432 via TCP"
    exit 1
fi

PORT=$1
PROTOCOL=${2:-http}
CONTAINER_ID=$(hostname)
HOSTNAME="${CONTAINER_ID}-${PORT}.${TUNNEL_BASE_DOMAIN}"

echo "Starting tunnel for port $PORT..."
echo "Public URL will be: https://${HOSTNAME}"

if [ "$PROTOCOL" = "http" ]; then
    inlets client \
        --remote="${INLETS_SERVER}" \
        --token="${INLETS_TOKEN}" \
        --upstream="http://localhost:${PORT}"
else
    inlets client \
        --remote="${INLETS_SERVER}" \
        --token="${INLETS_TOKEN}" \
        --upstream="localhost:${PORT}" \
        --tcp
fi
EOF

# Make the tunnel script executable and set environment variables
chmod +x /usr/local/bin/tunnel

# Export configuration for the tunnel script
export INLETS_SERVER
export INLETS_TOKEN
export TUNNEL_BASE_DOMAIN

# Also save to profile for persistence
echo "export INLETS_SERVER='$INLETS_SERVER'" >> /etc/profile.d/inlets.sh
echo "export INLETS_TOKEN='$INLETS_TOKEN'" >> /etc/profile.d/inlets.sh
echo "export TUNNEL_BASE_DOMAIN='$TUNNEL_BASE_DOMAIN'" >> /etc/profile.d/inlets.sh

echo "Inlets setup complete!"
echo "Use 'tunnel <port>' to expose a local port to the internet"