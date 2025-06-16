#!/bin/bash

# Start SSHpiper service

echo "=== Starting SSHpiper Service ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if SSHpiper key exists
echo -e "\n${YELLOW}1. Checking SSHpiper keypair...${NC}"
if [ ! -f "sshpiper/sshpiper_id_rsa" ] || [ ! -f "sshpiper/sshpiper_id_rsa.pub" ]; then
    echo -e "${RED}✗ SSHpiper keypair not found${NC}"
    echo "Generating SSHpiper keypair..."
    ./scripts/setup-sshpiper.sh
else
    echo -e "${GREEN}✓ SSHpiper keypair exists${NC}"
fi

# Check if workingdir exists
echo -e "\n${YELLOW}2. Checking workingdir structure...${NC}"
if [ ! -d "sshpiper/workingdir" ]; then
    echo -e "${YELLOW}Creating workingdir...${NC}"
    mkdir -p sshpiper/workingdir
fi
echo -e "${GREEN}✓ WorkingDir ready${NC}"

# Check if hostkeys directory exists
echo -e "\n${YELLOW}3. Checking hostkeys directory...${NC}"
if [ ! -d "sshpiper/hostkeys" ]; then
    echo -e "${YELLOW}Creating hostkeys directory...${NC}"
    mkdir -p sshpiper/hostkeys
fi
echo -e "${GREEN}✓ Hostkeys directory ready${NC}"

# Check if SSHpiper container is already running
echo -e "\n${YELLOW}4. Checking SSHpiper status...${NC}"
if docker ps --format "table {{.Names}}" | grep -q "claude-web-sshpiper"; then
    echo -e "${BLUE}SSHpiper is already running${NC}"
    echo "Would you like to restart it? (y/N)"
    read -r restart_choice
    if [[ $restart_choice =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Stopping existing SSHpiper...${NC}"
        docker stop claude-web-sshpiper
        docker rm claude-web-sshpiper
    else
        echo -e "${GREEN}Using existing SSHpiper instance${NC}"
        docker ps --filter name=claude-web-sshpiper
        exit 0
    fi
fi

# Start SSHpiper service
echo -e "\n${YELLOW}5. Starting SSHpiper...${NC}"
docker-compose up -d sshpiper

# Wait for SSHpiper to start
echo -e "\n${YELLOW}6. Waiting for SSHpiper to be ready...${NC}"
sleep 5

# Check if SSHpiper started successfully
if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "claude-web-sshpiper.*Up"; then
    echo -e "${GREEN}✓ SSHpiper started successfully!${NC}"
    
    # Show container status
    echo -e "\n${BLUE}Container Status:${NC}"
    docker ps --filter name=claude-web-sshpiper --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Show logs (last 10 lines)
    echo -e "\n${BLUE}Recent logs:${NC}"
    docker logs --tail 10 claude-web-sshpiper
    
    echo -e "\n${GREEN}SSHpiper is ready to accept connections on port 2222!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Upload SSH public keys through the web interface"
    echo "2. Test SSH connection: ssh user{userId}@localhost -p 2222"
    echo "3. Monitor logs: docker logs -f claude-web-sshpiper"
    
else
    echo -e "${RED}✗ Failed to start SSHpiper${NC}"
    echo "Check the logs for details:"
    docker logs claude-web-sshpiper
    exit 1
fi

echo -e "\n${BLUE}Useful commands:${NC}"
echo "• View logs: docker logs -f claude-web-sshpiper"
echo "• Stop service: docker stop claude-web-sshpiper"
echo "• Restart service: docker restart claude-web-sshpiper"
echo "• Check workingdir: ls -la sshpiper/workingdir/"
echo "• Debug connection: ssh -v user1@localhost -p 2222"