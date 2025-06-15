# Container Mode Status

## Current Configuration
- **Container Mode**: Enabled ✅
- **Container Image**: `claude-web-dev:latest` ✅
- **Cleanup Hours**: 24 hours (containers inactive for 24+ hours will be removed)
- **Cleanup Interval**: Every 1 hour (cleanup job runs hourly)

## Active Containers
```
claude-web-user-f870d658-637d-4bd2-b9b1-366ae642d782   Up 34 minutes
```

## Data Persistence
- User data volume: `claude-web-user-{userId}-data`
- Mounted at: `/home/developer`
- Survives container removal ✅

## Container Lifecycle Features

### ✅ Implemented Features

1. **Automatic Container Creation**
   - Each user gets a dedicated container on first session
   - Containers use the `claude-web-dev:latest` image
   - Resource limits can be configured (memory, CPU)

2. **Session Recovery After Server Restart**
   - Sessions are loaded from database on startup
   - Existing running containers are reused
   - New PTY connections are created to running containers
   - User work is preserved across server restarts

3. **Automatic Cleanup**
   - Periodic cleanup runs every hour
   - Removes stopped containers (exited > 1 hour ago)
   - Removes running containers with no activity for 24+ hours
   - Updates database to mark dead sessions

4. **Data Persistence**
   - Docker volumes store user data in `/home/developer`
   - Volumes persist after container removal
   - Data is restored when user creates new session

5. **Container Management**
   - Containers are named `claude-web-user-{userId}`
   - Support for both Docker and Podman runtimes
   - Graceful container lifecycle (create → start → stop → remove)

### 📊 Current Status

- Container mode is fully operational
- Session recovery works correctly after server restart
- Automatic cleanup is active and configured
- Data persistence through Docker volumes is working

### 🔧 Commands for Manual Management

```bash
# List all user containers
docker ps -a --filter "name=claude-web-user-"

# Check container logs
docker logs claude-web-user-{userId}

# Manually remove a container
docker stop claude-web-user-{userId}
docker rm claude-web-user-{userId}

# Check user volumes
docker volume ls | grep claude-web-user
```