#!/bin/bash

# Start all Claude Web services

echo "=== Starting All Claude Web Services ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Setup network
echo -e "\n${YELLOW}1. Setting up Docker network...${NC}"
./scripts/setup-network.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to setup network${NC}"
    exit 1
fi

# 2. Build/check images
echo -e "\n${YELLOW}2. Checking Docker images...${NC}"

# Check if dev image exists
if ! docker images "claude-web-dev:latest" --format "{{.Repository}}:{{.Tag}}" | grep -q "claude-web-dev:latest"; then
    echo -e "${YELLOW}Building dev container image...${NC}"
    ./scripts/rebuild-dev-image.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to build dev image${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Dev container image exists${NC}"
fi

# Check if SSHpiper image exists
if ! docker images "claude-web-sshpiper:latest" --format "{{.Repository}}:{{.Tag}}" | grep -q "claude-web-sshpiper:latest"; then
    echo -e "${YELLOW}Building custom SSHpiper image...${NC}"
    ./scripts/build-sshpiper.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to build SSHpiper image${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Custom SSHpiper image exists${NC}"
fi

# 3. Start SSHpiper
echo -e "\n${YELLOW}3. Starting SSHpiper...${NC}"
./scripts/sshpiper-docker.sh start
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start SSHpiper${NC}"
    exit 1
fi

# 4. Summary
echo -e "\n${BLUE}=== All Services Started ===${NC}"
echo ""
echo "Network: claude-web-bridge"
echo "  - Subnet: 172.20.0.0/16"
echo "  - Gateway: 172.20.0.1"
echo ""
echo "SSHpiper:"
echo "  - Port: 2222"
echo "  - WorkingDir: $(pwd)/sshpiper/workingdir"
echo ""
echo "Development containers will:"
echo "  - Use claude-web-bridge network"
echo "  - Run SSHD automatically"
echo "  - Be accessible via SSHpiper"
echo ""
echo -e "${GREEN}System ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the backend: cd backend && pnpm run dev"
echo "2. Start the frontend: cd frontend && pnpm start"
echo "3. Upload SSH keys through the web interface"
echo "4. Test SSH: ssh u{userId}@localhost -p 2222"