#!/bin/bash

# Script to display initial invite codes after database setup
# This is useful for administrators to get the randomly generated codes

set -e

echo "==================================="
echo "Claude Web Initial Setup"
echo "==================================="
echo ""

# Check if we're in Docker environment
if [ -f /.dockerenv ]; then
    echo "Running in Docker environment..."
    echo ""
    echo "To view initial invite codes, run:"
    echo "  docker exec -it claude-web-backend npm run invite:list"
    echo ""
    echo "To create new invite codes, run:"
    echo "  docker exec -it claude-web-backend npm run invite:create -- --count 5"
else
    echo "Running in local environment..."
    echo ""
    echo "To view initial invite codes, run:"
    echo "  cd backend && npm run invite:list:dev"
    echo ""
    echo "To create new invite codes, run:"
    echo "  cd backend && npm run invite:create:dev -- --count 5"
fi

echo ""
echo "==================================="
echo "Security Notes:"
echo "==================================="
echo "1. Initial invite codes are randomly generated"
echo "2. All codes expire after 30 days by default"
echo "3. Enable invite-only registration with:"
echo "   npm run config:set require_invite_code true"
echo ""
echo "For more options, see the documentation."