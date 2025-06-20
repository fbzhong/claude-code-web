#!/bin/bash

# Rebuild the development container image

echo "=== Rebuilding Claude Code Web Development Container Image ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

IMAGE_NAME="claude-web-dev"
IMAGE_TAG="latest"
DOCKERFILE_PATH="docker/dev-container/Dockerfile"

echo -e "\n${YELLOW}1. Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE_PATH" ]; then
    echo -e "${RED}✗ Dockerfile not found: $DOCKERFILE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"

echo -e "\n${YELLOW}2. Building Docker image...${NC}"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"

# Build the image
if docker build -t "$IMAGE_NAME:$IMAGE_TAG" -f "$DOCKERFILE_PATH" docker/dev-container/; then
    echo -e "\n${GREEN}✓ Docker image built successfully!${NC}"
else
    echo -e "\n${RED}✗ Failed to build Docker image${NC}"
    exit 1
fi

echo -e "\n${YELLOW}3. Image information:${NC}"
docker images "$IMAGE_NAME:$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "\n${BLUE}=== Build Complete ===${NC}"
echo ""
echo "Image built: ${GREEN}$IMAGE_NAME:$IMAGE_TAG${NC}"
echo ""
echo "The dev container image has been rebuilt with:"
echo "  - Proper SSHD startup script"
echo "  - SSH host key generation"
echo "  - Network connectivity for claude-web-bridge"
echo ""
echo "To test the container:"
echo "  docker run -d --name test-dev --network claude-web-bridge $IMAGE_NAME:$IMAGE_TAG"
echo "  docker exec test-dev ps aux | grep sshd"
echo "  docker rm -f test-dev"
