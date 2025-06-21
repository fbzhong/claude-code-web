#!/bin/bash
# Startup script for Inlets server

set -e

# Configuration from environment variables
TOKEN="${INLETS_TOKEN:-$(head -c 32 /dev/urandom | base64 | tr -d '+/=' | head -c 32)}"
CONTROL_PORT="${INLETS_CONTROL_PORT:-8090}"
DATA_PORT="${INLETS_DATA_PORT:-8080}"
DOMAIN="${INLETS_DOMAIN:-tunnel.local}"

# Log configuration
echo "Starting Inlets OSS Server"
echo "=========================="
echo "Control Port: $CONTROL_PORT"
echo "Data Port: $DATA_PORT"
echo "Domain: *.$DOMAIN"
echo "Token: $TOKEN"
echo ""

# Create token file for easy access
echo "$TOKEN" > /data/token.txt
chmod 600 /data/token.txt

# Start inlets server
# Note: Inlets OSS doesn't have all the features of Inlets Pro,
# but it supports basic HTTP tunneling
exec inlets server \
    --port=$CONTROL_PORT \
    --control-port=$CONTROL_PORT \
    --data-addr=0.0.0.0:$DATA_PORT \
    --token="$TOKEN" \
    --print-token=false