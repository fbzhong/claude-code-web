# Container Lifecycle Management

## Overview

Claude Web uses Docker/Podman containers to provide isolated environments for each user. This document explains how container lifecycle is managed.

## Session Recovery After Server Restart

✅ **Sessions are automatically recovered** when the server restarts:

1. On startup, the server loads all `active` and `detached` sessions from the database
2. Sessions are restored to memory with status `detached` (no PTY connection)
3. When a user reconnects, the system:
   - Finds the existing running container
   - Creates a new PTY connection to the container
   - Restores the terminal session with all previous work intact

**Important**: Containers continue running even when the server is down, preserving user environments.

## Container Cleanup Policy

The system automatically cleans up inactive containers to save resources:

### Default Settings
- **Inactivity threshold**: 24 hours (configurable)
- **Cleanup interval**: Every 1 hour (configurable)

### Cleanup Rules

1. **Stopped Containers**:
   - Removed if exited more than 1 hour ago
   - Immediate cleanup for crashed containers

2. **Running Containers**:
   - Checked against user's last session activity in database
   - Removed if no activity for more than the threshold (default: 24 hours)
   - Containers with no sessions are removed based on uptime

### Configuration

Set these environment variables in `.env`:

```bash
# Hours of inactivity before container removal (default: 24)
CONTAINER_CLEANUP_HOURS=24

# How often to run cleanup in hours (default: 1)
CONTAINER_CLEANUP_INTERVAL_HOURS=1
```

### What Happens During Cleanup

1. Container is stopped gracefully
2. Container is removed
3. Associated sessions are marked as `dead` in database
4. User data persists in Docker volumes

## Data Persistence

User data is stored in Docker volumes:
- Volume name: `claude-web-user-{userId}-data`
- Mounted at: `/home/developer`
- Survives container removal
- Restored when user creates new session

## Manual Container Management

### List all Claude Web containers
```bash
docker ps -a --filter "name=claude-web-user-"
```

### Remove specific user's container
```bash
docker stop claude-web-user-{userId}
docker rm claude-web-user-{userId}
```

### Remove all stopped containers
```bash
docker container prune -f
```

### Check container activity
```bash
# View container creation time and status
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
```

## Best Practices

1. **For Development**: Set shorter cleanup times (e.g., 4-8 hours)
2. **For Production**: Use longer cleanup times (e.g., 24-72 hours)
3. **Monitor disk usage**: Containers and volumes consume disk space
4. **Regular maintenance**: Periodically clean orphaned volumes

## Troubleshooting

### Container not cleaned up
- Check logs for cleanup errors
- Verify database connectivity
- Ensure cleanup interval is running

### Session cannot reconnect
- Check if container still exists: `docker ps -a`
- Verify container is running
- Check container logs: `docker logs claude-web-user-{userId}`

### Data loss after cleanup
- User data should persist in volumes
- Check volume exists: `docker volume ls | grep claude-web-user`
- Restore from volume if needed