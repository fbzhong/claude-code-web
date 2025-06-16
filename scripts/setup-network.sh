#!/bin/bash

# Setup Docker network for Claude Web

echo "=== Setting up Docker Network for Claude Web ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

NETWORK_NAME="claude-web-bridge"

# Check if Docker is running
echo -e "\n${YELLOW}1. Checking Docker status...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if network already exists
echo -e "\n${YELLOW}2. Checking if network exists...${NC}"
if docker network ls --format "{{.Name}}" | grep -q "^${NETWORK_NAME}$"; then
    echo -e "${BLUE}Network '${NETWORK_NAME}' already exists${NC}"
    
    # Show network details
    echo -e "\n${YELLOW}Network details:${NC}"
    docker network inspect "${NETWORK_NAME}" --format '{{json .}}' | jq -r '
        "Name: " + .Name + "\n" +
        "Driver: " + .Driver + "\n" +
        "Subnet: " + .IPAM.Config[0].Subnet + "\n" +
        "Gateway: " + .IPAM.Config[0].Gateway + "\n" +
        "Created: " + .Created
    ' 2>/dev/null || docker network inspect "${NETWORK_NAME}"
    
    echo -e "\n${YELLOW}Connected containers:${NC}"
    docker network inspect "${NETWORK_NAME}" --format '{{range $k, $v := .Containers}}{{printf "  - %s (%s)\n" $v.Name $v.IPv4Address}}{{end}}' || echo "  None"
    
else
    # Create network
    echo -e "${YELLOW}Creating network '${NETWORK_NAME}'...${NC}"
    
    if docker network create \
        --driver bridge \
        --subnet 172.20.0.0/16 \
        --gateway 172.20.0.1 \
        --label "project=claude-web" \
        --label "purpose=internal-communication" \
        "${NETWORK_NAME}"; then
        
        echo -e "${GREEN}✓ Network '${NETWORK_NAME}' created successfully${NC}"
        
        # Show created network details
        echo -e "\n${YELLOW}Network configuration:${NC}"
        echo "  Name: ${NETWORK_NAME}"
        echo "  Driver: bridge"
        echo "  Subnet: 172.20.0.0/16"
        echo "  Gateway: 172.20.0.1"
        
    else
        echo -e "${RED}✗ Failed to create network${NC}"
        exit 1
    fi
fi

echo -e "\n${BLUE}=== Network Setup Complete ===${NC}"
echo ""
echo "To connect a container to this network:"
echo "  docker run --network ${NETWORK_NAME} ..."
echo ""
echo "To connect an existing container:"
echo "  docker network connect ${NETWORK_NAME} <container-name>"
echo ""
echo "To list all containers on this network:"
echo "  docker network inspect ${NETWORK_NAME} | jq '.Containers'"
echo ""
echo "To remove this network (when no containers are connected):"
echo "  docker network rm ${NETWORK_NAME}"