#!/bin/bash

# SSHpiper Standalone Docker Management Script

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="claude-web-sshpiper"
IMAGE_NAME="claude-web-sshpiper:latest"
SSH_PORT="2222"
WORKING_DIR="$(pwd)/sshpiper/workingdir"
HOSTKEYS_DIR="$(pwd)/sshpiper/hostkeys"

show_usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|debug|remove}"
    echo ""
    echo "Commands:"
    echo "  start   - Start SSHpiper container"
    echo "  stop    - Stop SSHpiper container"
    echo "  restart - Restart SSHpiper container"
    echo "  status  - Show container status and info"
    echo "  logs    - Show container logs"
    echo "  debug   - Show debug information"
    echo "  remove  - Stop and remove container"
    echo ""
}

check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}"
        exit 1
    fi
    
    # Check if SSHpiper key exists
    if [ ! -f "sshpiper/sshpiper_id_rsa" ] || [ ! -f "sshpiper/sshpiper_id_rsa.pub" ]; then
        echo -e "${YELLOW}Setting up SSHpiper keypair...${NC}"
        if [ -f "./scripts/setup-sshpiper.sh" ]; then
            ./scripts/setup-sshpiper.sh
        else
            echo -e "${RED}✗ setup-sshpiper.sh script not found${NC}"
            echo "Please run: ssh-keygen -t rsa -b 4096 -f sshpiper/sshpiper_id_rsa -N ''"
            exit 1
        fi
    fi
    
    # Ensure directories exist
    mkdir -p "$WORKING_DIR" "$HOSTKEYS_DIR"
    
    echo -e "${GREEN}✓ Prerequisites checked${NC}"
}

start_container() {
    echo -e "${YELLOW}Starting SSHpiper container...${NC}"
    
    check_prerequisites
    
    # Check if container is already running
    if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${BLUE}Container '${CONTAINER_NAME}' is already running${NC}"
        return 0
    fi
    
    # Remove existing stopped container if it exists
    if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Removing existing stopped container...${NC}"
        docker rm "${CONTAINER_NAME}" >/dev/null 2>&1
    fi
    
    # Check if custom image exists
    if ! docker images "${IMAGE_NAME}" --format "{{.Repository}}:{{.Tag}}" | grep -q "${IMAGE_NAME}"; then
        echo -e "${RED}✗ Custom SSHpiper image not found: ${IMAGE_NAME}${NC}"
        echo "Please build it first with: ./scripts/build-sshpiper.sh"
        exit 1
    fi
    echo -e "${GREEN}✓ Using custom SSHpiper image: ${IMAGE_NAME}${NC}"
    
    # Ensure network exists
    echo -e "${YELLOW}Ensuring Docker network exists...${NC}"
    if ! docker network ls --format "{{.Name}}" | grep -q "^claude-web-bridge$"; then
        echo "Creating claude-web-bridge network..."
        docker network create \
            --driver bridge \
            --subnet 172.20.0.0/16 \
            --gateway 172.20.0.1 \
            claude-web-bridge || true
    fi
    
    # Start the container
    echo -e "${YELLOW}Creating and starting container...${NC}"
    docker run -d \
        --name "${CONTAINER_NAME}" \
        --restart unless-stopped \
        --network claude-web-bridge \
        -p "${SSH_PORT}:${SSH_PORT}" \
        -v "${WORKING_DIR}:/sshpiper/workingdir:rw" \
        -v "${HOSTKEYS_DIR}:/sshpiper/hostkeys:ro" \
        -e SSHPIPER_PORT="${SSH_PORT}" \
        -e SSHPIPER_SERVER_KEY="/sshpiper/hostkeys/ssh_host_ed25519_key" \
        -e SSHPIPER_WORKINGDIR_ROOT="/sshpiper/workingdir" \
        -e SSHPIPER_LOG_LEVEL="debug" \
        -e SSHPIPER_UPSTREAM_DRIVER="workingdir" \
        "${IMAGE_NAME}"
    
    # Wait for container to start
    sleep 3
    
    # Check if container started successfully
    if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${GREEN}✓ SSHpiper container started successfully!${NC}"
        echo -e "${BLUE}Container is listening on port ${SSH_PORT}${NC}"
        
        # Show container info
        docker ps --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        
        echo ""
        echo -e "${GREEN}SSHpiper is ready!${NC}"
        echo -e "${YELLOW}Next steps:${NC}"
        echo "1. Upload SSH public keys through the web interface"
        echo "2. Test SSH connection: ssh user{userId}@localhost -p ${SSH_PORT}"
        
    else
        echo -e "${RED}✗ Failed to start SSHpiper container${NC}"
        echo "Check logs: docker logs ${CONTAINER_NAME}"
        return 1
    fi
}

stop_container() {
    echo -e "${YELLOW}Stopping SSHpiper container...${NC}"
    
    if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
        echo -e "${GREEN}✓ Container stopped${NC}"
    else
        echo -e "${BLUE}Container is not running${NC}"
    fi
}

restart_container() {
    echo -e "${YELLOW}Restarting SSHpiper container...${NC}"
    stop_container
    sleep 2
    start_container
}

remove_container() {
    echo -e "${YELLOW}Removing SSHpiper container...${NC}"
    
    # Stop if running
    if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
    fi
    
    # Remove container
    if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker rm "${CONTAINER_NAME}"
        echo -e "${GREEN}✓ Container removed${NC}"
    else
        echo -e "${BLUE}Container does not exist${NC}"
    fi
}

show_status() {
    echo -e "${BLUE}=== SSHpiper Container Status ===${NC}"
    
    # Container status
    if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${GREEN}✓ Container: Running${NC}"
        docker ps --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}"
        
        # Show resource usage
        echo ""
        echo -e "${BLUE}Resource Usage:${NC}"
        docker stats "${CONTAINER_NAME}" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
        
    else
        echo -e "${RED}✗ Container: Not running${NC}"
        # Check if container exists but stopped
        if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
            echo -e "${YELLOW}Container exists but is stopped${NC}"
            docker ps -a --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
        else
            echo -e "${BLUE}Container does not exist${NC}"
        fi
    fi
    
    echo ""
    
    # Configuration files
    echo -e "${BLUE}Configuration:${NC}"
    if [ -f "sshpiper/sshpiper_id_rsa" ]; then
        echo -e "${GREEN}✓ Private key: sshpiper/sshpiper_id_rsa${NC}"
        ls -la sshpiper/sshpiper_id_rsa
    else
        echo -e "${RED}✗ Private key missing${NC}"
    fi
    
    if [ -f "sshpiper/sshpiper_id_rsa.pub" ]; then
        echo -e "${GREEN}✓ Public key: sshpiper/sshpiper_id_rsa.pub${NC}"
    else
        echo -e "${RED}✗ Public key missing${NC}"
    fi
    
    if [ -d "$WORKING_DIR" ]; then
        user_count=$(find "$WORKING_DIR" -maxdepth 1 -type d -name "user*" 2>/dev/null | wc -l)
        echo -e "${GREEN}✓ WorkingDir: $WORKING_DIR${NC} (${user_count} user directories)"
    else
        echo -e "${RED}✗ WorkingDir missing: $WORKING_DIR${NC}"
    fi
    
    echo ""
    
    # Network connectivity
    echo -e "${BLUE}Network:${NC}"
    if command -v nc &> /dev/null; then
        if nc -z localhost "${SSH_PORT}" 2>/dev/null; then
            echo -e "${GREEN}✓ Port ${SSH_PORT} is accessible${NC}"
        else
            echo -e "${RED}✗ Port ${SSH_PORT} is not accessible${NC}"
        fi
    else
        if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
            echo -e "${YELLOW}? Port check requires 'nc' command${NC}"
        fi
    fi
}

show_logs() {
    echo -e "${BLUE}=== SSHpiper Container Logs ===${NC}"
    
    if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "Recent logs (last 50 lines):"
        echo "Press Ctrl+C to stop following logs"
        echo "---"
        docker logs --tail 50 -f "${CONTAINER_NAME}"
    else
        echo -e "${RED}Container '${CONTAINER_NAME}' does not exist${NC}"
    fi
}

show_debug() {
    echo -e "${BLUE}=== SSHpiper Debug Information ===${NC}"
    
    # Basic status
    show_status
    
    echo ""
    echo -e "${BLUE}Container Configuration:${NC}"
    if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker inspect "${CONTAINER_NAME}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep SSHPIPER
        echo ""
        echo -e "${BLUE}Container Mounts:${NC}"
        docker inspect "${CONTAINER_NAME}" --format '{{range .Mounts}}{{printf "%-20s → %s\n" .Source .Destination}}{{end}}'
    else
        echo "Container does not exist"
    fi
    
    echo ""
    echo -e "${BLUE}Working Directory Contents:${NC}"
    if [ -d "$WORKING_DIR" ]; then
        find "$WORKING_DIR" -type f 2>/dev/null | head -20 | while read -r file; do
            echo "  $file"
        done
    else
        echo "  WorkingDir does not exist"
    fi
    
    echo ""
    echo -e "${BLUE}Docker Image Info:${NC}"
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    echo ""
    echo -e "${BLUE}Test Commands:${NC}"
    echo "• SSH connection test: ssh -v -o ConnectTimeout=5 user1@localhost -p ${SSH_PORT}"
    echo "• Check listening ports: docker exec ${CONTAINER_NAME} netstat -tlnp"
    echo "• Container shell: docker exec -it ${CONTAINER_NAME} /bin/sh"
}

# Main script logic
case "${1:-}" in
    start)
        start_container
        ;;
    stop)
        stop_container
        ;;
    restart)
        restart_container
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    debug)
        show_debug
        ;;
    remove)
        remove_container
        ;;
    *)
        show_usage
        exit 1
        ;;
esac