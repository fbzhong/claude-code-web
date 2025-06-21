#!/bin/bash
# Script to set up and configure inlets for Claude Web

set -e

echo "Setting up Inlets Server for Claude Web"
echo "======================================="

# Function to generate a secure token
generate_token() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Check if running in development or production
if [ "$1" = "prod" ]; then
    ENV_FILE=".env.production"
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "Setting up for PRODUCTION environment"
else
    ENV_FILE=".env"
    COMPOSE_FILE="docker-compose.yml"
    echo "Setting up for DEVELOPMENT environment"
fi

# Create env file if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE..."
    touch "$ENV_FILE"
fi

# Function to set or update env variable
set_env_var() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$ENV_FILE"; then
        # Update existing value
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        # Add new value
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

# Generate or use existing token
if [ -z "$INLETS_TOKEN" ]; then
    INLETS_TOKEN=$(generate_token)
    echo "Generated new inlets token: $INLETS_TOKEN"
    set_env_var "INLETS_TOKEN" "$INLETS_TOKEN"
else
    echo "Using existing INLETS_TOKEN from environment"
fi

# Set default values if not provided
INLETS_DOMAIN=${INLETS_DOMAIN:-"tunnel.localhost"}
INLETS_CONTROL_PORT=${INLETS_CONTROL_PORT:-"8090"}
INLETS_DATA_PORT=${INLETS_DATA_PORT:-"8080"}
INLETS_STATUS_PORT=${INLETS_STATUS_PORT:-"8091"}

# Update env file
echo "Updating environment variables..."
set_env_var "INLETS_DOMAIN" "$INLETS_DOMAIN"
set_env_var "INLETS_CONTROL_PORT" "$INLETS_CONTROL_PORT"
set_env_var "INLETS_DATA_PORT" "$INLETS_DATA_PORT"
set_env_var "INLETS_STATUS_PORT" "$INLETS_STATUS_PORT"

# Build inlets server image
echo -e "\nBuilding inlets server image..."
docker-compose -f "$COMPOSE_FILE" build inlets

# Start inlets server
echo -e "\nStarting inlets server..."
docker-compose -f "$COMPOSE_FILE" up -d inlets

# Wait for inlets to be ready
echo -n "Waiting for inlets server to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:${INLETS_STATUS_PORT}/health" > /dev/null 2>&1; then
        echo " Ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Configure Claude Web to use inlets
echo -e "\nConfiguring Claude Web to use inlets..."
cd backend

# Configure inlets in the database
npm run config:set tunnels_enabled true
npm run config:set inlets_server_url "ws://localhost:${INLETS_CONTROL_PORT}"
npm run config:set inlets_status_api_url "http://localhost:${INLETS_STATUS_PORT}/status"
npm run config:set inlets_shared_token "$INLETS_TOKEN"
npm run config:set tunnel_base_domain "$INLETS_DOMAIN"

# Show configuration
echo -e "\nInlets configuration:"
npm run config:list -v | grep -E "(tunnel|inlets)"

echo -e "\n✅ Inlets server setup complete!"
echo ""
echo "Inlets server is running with:"
echo "  Control plane: ws://localhost:${INLETS_CONTROL_PORT}"
echo "  Data plane: http://localhost:${INLETS_DATA_PORT}"
echo "  Status API: http://localhost:${INLETS_STATUS_PORT}"
echo "  Domain: *.${INLETS_DOMAIN}"
echo "  Token: $INLETS_TOKEN"
echo ""
echo "To test tunnels:"
echo "1. Start a user container"
echo "2. Inside the container, run: tunnel 3000"
echo "3. Access your app at: http://[container-id]-3000.${INLETS_DOMAIN}:${INLETS_DATA_PORT}"
echo ""
echo "For production with a real domain:"
echo "1. Point *.yourdomain.com to your server IP"
echo "2. Set INLETS_DOMAIN=yourdomain.com"
echo "3. Use a reverse proxy (nginx) to handle SSL termination"