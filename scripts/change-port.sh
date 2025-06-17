#!/bin/bash

# Default ports
DEFAULT_API_PORT=12021
DEFAULT_WEB_PORT=12020

# Get new ports from command line arguments
API_PORT=${1:-$DEFAULT_API_PORT}
WEB_PORT=${2:-$DEFAULT_WEB_PORT}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Changing ports...${NC}"
echo -e "Backend port: ${GREEN}$API_PORT${NC}"
echo -e "Frontend port: ${GREEN}$WEB_PORT${NC}"

# Update backend/.env
if [ -f "backend/.env" ]; then
    # Update PORT in backend/.env
    sed -i.bak "s/^PORT=.*/PORT=$API_PORT/" backend/.env

    # Update WEB_URL in backend/.env
    sed -i.bak "s|^WEB_URL=.*|WEB_URL=http://localhost:$WEB_PORT|" backend/.env

    echo -e "${GREEN}✓${NC} Updated backend/.env"

    # Remove backup file
    rm -f backend/.env.bak
else
    echo -e "${RED}✗${NC} backend/.env not found"
fi

# Update frontend/.env
if [ -f "frontend/.env" ]; then
    # Update PORT in frontend/.env
    sed -i.bak "s/^PORT=.*/PORT=$WEB_PORT/" frontend/.env

    # Update API_URL in frontend/.env
    sed -i.bak "s|^API_URL=.*|API_URL=http://localhost:$API_PORT|" frontend/.env

    echo -e "${GREEN}✓${NC} Updated frontend/.env"

    # Remove backup file
    rm -f frontend/.env.bak
else
    echo -e "${RED}✗${NC} frontend/.env not found"
fi

echo -e "${GREEN}Port change complete!${NC}"
echo ""
echo "Usage:"
echo "  ./scripts/change-port.sh [API_PORT] [WEB_PORT]"
echo ""
echo "Example:"
echo "  ./scripts/change-port.sh 8080 3000"
echo ""
echo "Default ports:"
echo "  Backend: $DEFAULT_API_PORT"
echo "  Frontend: $DEFAULT_WEB_PORT"
