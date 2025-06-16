#!/bin/bash

# Setup script for SSHpiper workingDir mode

set -e

echo "=== Setting up SSHpiper for Claude Web ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to project root
cd "$(dirname "$0")/.."

# Create necessary directories
echo -e "\n${YELLOW}Creating SSHpiper directories...${NC}"
mkdir -p sshpiper/{workingdir,hostkeys}
echo -e "${GREEN}✓ Directories created${NC}"

# Check if SSHpiper keypair already exists
if [ -f "sshpiper/sshpiper_id_rsa" ]; then
    echo -e "\n${YELLOW}SSHpiper keypair already exists, skipping generation${NC}"
else
    echo -e "\n${YELLOW}Generating SSHpiper RSA keypair...${NC}"
    ssh-keygen -t rsa -b 4096 -f sshpiper/sshpiper_id_rsa -N "" -C "sshpiper-to-container"
    echo -e "${GREEN}✓ SSHpiper keypair generated${NC}"
fi

# Show the public key that needs to be in containers
echo -e "\n${YELLOW}SSHpiper public key (already included in container image):${NC}"
cat sshpiper/sshpiper_id_rsa.pub

# Set proper permissions
echo -e "\n${YELLOW}Setting permissions...${NC}"
chmod 600 sshpiper/sshpiper_id_rsa
chmod 644 sshpiper/sshpiper_id_rsa.pub
chmod 755 sshpiper/workingdir
echo -e "${GREEN}✓ Permissions set${NC}"

# Generate host keys for SSHpiper if not exist
if [ ! -f "sshpiper/hostkeys/ssh_host_rsa_key" ]; then
    echo -e "\n${YELLOW}Generating SSHpiper host keys...${NC}"
    ssh-keygen -t rsa -b 4096 -f sshpiper/hostkeys/ssh_host_rsa_key -N ""
    ssh-keygen -t ed25519 -f sshpiper/hostkeys/ssh_host_ed25519_key -N ""
    echo -e "${GREEN}✓ Host keys generated${NC}"
fi

echo -e "\n${GREEN}=== SSHpiper setup complete ===${NC}"
echo -e "\nNext steps:"
echo "1. Rebuild the dev container image to include the SSHpiper public key:"
echo "   docker-compose build"
echo "2. Start the services:"
echo "   docker-compose up -d"
echo "3. The system will be ready to accept SSH connections via:"
echo "   ssh user{userId}@localhost -p 2222"