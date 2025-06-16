#!/bin/bash

# Default ports
DEFAULT_BACKEND_PORT=12021
DEFAULT_FRONTEND_PORT=12020

# Get new ports from command line arguments
BACKEND_PORT=${1:-$DEFAULT_BACKEND_PORT}
FRONTEND_PORT=${2:-$DEFAULT_FRONTEND_PORT}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Changing ports...${NC}"
echo -e "Backend port: ${GREEN}$BACKEND_PORT${NC}"
echo -e "Frontend port: ${GREEN}$FRONTEND_PORT${NC}"

# Update backend/.env
if [ -f "backend/.env" ]; then
    # Update PORT in backend/.env
    sed -i.bak "s/^PORT=.*/PORT=$BACKEND_PORT/" backend/.env
    
    # Update FRONTEND_URL in backend/.env
    sed -i.bak "s|^FRONTEND_URL=.*|FRONTEND_URL=http://localhost:$FRONTEND_PORT|" backend/.env
    
    echo -e "${GREEN}✓${NC} Updated backend/.env"
    
    # Remove backup file
    rm -f backend/.env.bak
else
    echo -e "${RED}✗${NC} backend/.env not found"
fi

# Update frontend/.env
if [ -f "frontend/.env" ]; then
    # Update PORT in frontend/.env
    sed -i.bak "s/^PORT=.*/PORT=$FRONTEND_PORT/" frontend/.env
    
    # Update REACT_APP_API_URL in frontend/.env
    sed -i.bak "s|^REACT_APP_API_URL=.*|REACT_APP_API_URL=http://localhost:$BACKEND_PORT|" frontend/.env
    
    echo -e "${GREEN}✓${NC} Updated frontend/.env"
    
    # Remove backup file
    rm -f frontend/.env.bak
else
    echo -e "${RED}✗${NC} frontend/.env not found"
fi

echo -e "${GREEN}Port change complete!${NC}"
echo ""
echo "Usage:"
echo "  ./scripts/change-port.sh [backend_port] [frontend_port]"
echo ""
echo "Example:"
echo "  ./scripts/change-port.sh 8080 3000"
echo ""
echo "Default ports:"
echo "  Backend: $DEFAULT_BACKEND_PORT"
echo "  Frontend: $DEFAULT_FRONTEND_PORT"