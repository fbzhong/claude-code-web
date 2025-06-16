#!/bin/bash

set -e

# Function to generate default host key if not provided
generate_host_key() {
    local key_path="/etc/ssh/ssh_host_rsa_key"
    if [ ! -f "$key_path" ]; then
        echo "Generating default SSH host key..."
        ssh-keygen -t rsa -b 4096 -f "$key_path" -N "" -C "sshpiper@docker"
        chmod 600 "$key_path"
        chmod 644 "${key_path}.pub"
    fi
    echo "$key_path"
}

# Build sshpiperd command
SSHPIPER_CMD="/usr/local/bin/sshpiperd"

# Configure port
if [ -n "$SSHPIPER_PORT" ]; then
    SSHPIPER_CMD="$SSHPIPER_CMD --port $SSHPIPER_PORT"
fi

# Configure server key
if [ -n "$SSHPIPER_SERVER_KEY" ] && [ -f "$SSHPIPER_SERVER_KEY" ]; then
    SSHPIPER_CMD="$SSHPIPER_CMD --server-key $SSHPIPER_SERVER_KEY"
    echo "Using custom server key: $SSHPIPER_SERVER_KEY"
else
    # Generate or use default key
    DEFAULT_KEY=$(generate_host_key)
    SSHPIPER_CMD="$SSHPIPER_CMD --server-key $DEFAULT_KEY"
    echo "Using default server key: $DEFAULT_KEY"
fi

# Configure log level
if [ -n "$SSHPIPER_LOG_LEVEL" ]; then
    SSHPIPER_CMD="$SSHPIPER_CMD --log-level $SSHPIPER_LOG_LEVEL"
fi

# Configure upstream driver and workingdir
if [ "$SSHPIPER_UPSTREAM_DRIVER" = "workingdir" ]; then
    # Add the workingdir plugin
    PLUGIN_PATH="/usr/local/bin/plugins/workingdir"
    
    # Ensure workingdir exists
    if [ -n "$SSHPIPER_WORKINGDIR_ROOT" ]; then
        if [ ! -d "$SSHPIPER_WORKINGDIR_ROOT" ]; then
            echo "Creating workingdir: $SSHPIPER_WORKINGDIR_ROOT"
            mkdir -p "$SSHPIPER_WORKINGDIR_ROOT"
        fi
        echo "Using workingdir root: $SSHPIPER_WORKINGDIR_ROOT"
    fi
    
    # Add plugin with arguments
    SSHPIPER_CMD="$SSHPIPER_CMD $PLUGIN_PATH --root $SSHPIPER_WORKINGDIR_ROOT"
fi

# Print configuration
echo "Starting SSHpiper with configuration:"
echo "  Port: ${SSHPIPER_PORT:-2222}"
echo "  Server Key: ${SSHPIPER_SERVER_KEY:-auto-generated}"
echo "  Upstream Driver: ${SSHPIPER_UPSTREAM_DRIVER:-workingdir}"
echo "  WorkingDir Root: ${SSHPIPER_WORKINGDIR_ROOT:-/var/sshpiper}"
echo "  Log Level: ${SSHPIPER_LOG_LEVEL:-info}"
echo ""
echo "Full command: $SSHPIPER_CMD"
echo ""

# Execute sshpiperd
exec $SSHPIPER_CMD "$@"