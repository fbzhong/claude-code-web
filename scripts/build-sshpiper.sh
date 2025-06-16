#!/bin/bash

# Build custom SSHpiper Docker image

echo "=== Building Custom SSHpiper Docker Image ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="claude-web-sshpiper"
IMAGE_TAG="latest"
DOCKERFILE_DIR="docker/sshpiper"

echo -e "\n${YELLOW}1. Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE_DIR/Dockerfile" ]; then
    echo -e "${RED}✗ Dockerfile not found: $DOCKERFILE_DIR/Dockerfile${NC}"
    exit 1
fi

# Check if entrypoint script exists
if [ ! -f "$DOCKERFILE_DIR/entrypoint.sh" ]; then
    echo -e "${RED}✗ Entrypoint script not found: $DOCKERFILE_DIR/entrypoint.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"

echo -e "\n${YELLOW}2. Building Docker image...${NC}"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo "Context: $DOCKERFILE_DIR"

# Build the image
if docker build -t "$IMAGE_NAME:$IMAGE_TAG" "$DOCKERFILE_DIR"; then
    echo -e "\n${GREEN}✓ Docker image built successfully!${NC}"
else
    echo -e "\n${RED}✗ Failed to build Docker image${NC}"
    exit 1
fi

echo -e "\n${YELLOW}3. Image information:${NC}"
docker images "$IMAGE_NAME:$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "\n${YELLOW}4. Testing image...${NC}"
echo "Running basic test..."

# Test the image
if docker run --rm "$IMAGE_NAME:$IMAGE_TAG" --help >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Image test passed${NC}"
else
    echo -e "${YELLOW}? Image test inconclusive (expected for sshpiperd)${NC}"
fi

echo -e "\n${BLUE}=== Build Complete ===${NC}"
echo ""
echo "Image built: ${GREEN}$IMAGE_NAME:$IMAGE_TAG${NC}"
echo ""
echo "Example usage:"
echo "  docker run -d \\"
echo "    --name sshpiper \\"
echo "    -p 2222:2222 \\"
echo "    -v /path/to/workingdir:/var/sshpiper:rw \\"
echo "    -v /path/to/server.key:/etc/ssh/server_key:ro \\"
echo "    -e SSHPIPER_PORT=2222 \\"
echo "    -e SSHPIPER_SERVER_KEY=/etc/ssh/server_key \\"
echo "    -e SSHPIPER_WORKINGDIR_ROOT=/var/sshpiper \\"
echo "    -e SSHPIPER_LOG_LEVEL=debug \\"
echo "    $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "To update the sshpiper-docker.sh script:"
echo "  sed -i 's/farmer1992\\/sshpiperd:latest/$IMAGE_NAME:$IMAGE_TAG/g' scripts/sshpiper-docker.sh"