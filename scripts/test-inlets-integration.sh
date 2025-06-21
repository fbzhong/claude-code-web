#!/bin/bash
# Script to test the inlets integration

echo "Testing Inlets Integration for Claude Web"
echo "========================================="

# Check if backend is running
echo -n "Checking if backend is running... "
if curl -s http://localhost:12021/health > /dev/null; then
    echo "✓"
else
    echo "✗"
    echo "Backend is not running. Please start it with: cd backend && pnpm run dev"
    exit 1
fi

# Configure inlets settings
echo -e "\nConfiguring inlets settings..."
cd backend

# Set tunnels configuration
npm run config:set tunnels_enabled true
npm run config:set inlets_server_url "wss://inlets.example.com"
npm run config:set inlets_status_api_url "https://inlets.example.com/status"
npm run config:set inlets_shared_token "test-shared-token"
npm run config:set tunnel_base_domain "tunnel.example.com"

# Show configuration
echo -e "\nCurrent configuration:"
npm run config:list -v | grep -E "(tunnel|inlets)"

echo -e "\nInlets integration is now configured!"
echo "To test the endpoints:"
echo "1. Login to the frontend"
echo "2. Check the session drawer - you should see the Tunnels section"
echo "3. The tunnels list will show active tunnels from the inlets server"

echo -e "\nTo test in a container:"
echo "1. Rebuild the container: docker-compose build dev-container"
echo "2. Start a container and check /usr/local/bin/tunnel script"
echo "3. Run: tunnel 3000  # to expose port 3000"