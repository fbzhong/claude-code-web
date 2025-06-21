# Inlets Integration Design Document

## Overview

This document describes the design and implementation of an ngrok-like feature for Claude Web that allows users to expose internal container ports to the internet using Inlets OSS as the forwarding service.

**Key Design Principle**: All configuration is stored in and read from the database using the existing dynamic configuration system. No hardcoded values or environment variables are used for inlets configuration.

## Architecture

### System Flow

```
Frontend                        Claude Web Backend              Inlets Server
    |                                   |                             |
    |-- Request tunnel list ----------->|                             |
    |                                   |                             |
    |                                   |-- Get status -------------->|
    |                                   |                             |
    |                                   |<-- All active tunnels -----|
    |                                   |                             |
    |<-- Filtered tunnels by user ------|                             |
    |    (only user's containers)       |                             |
```

### Components

1. **Inlets Server** (External)
   - Runs on a public server with a wildcard domain (e.g., *.tunnel.example.com)
   - Handles incoming HTTP/HTTPS traffic and forwards to connected clients
   - Manages tunnel authentication and routing
   - Provides status API to query active tunnels
   - Containers connect directly using pre-configured inlets client

2. **Backend API** (Claude Web Backend)
   - Proxy endpoints to inlets server status API
   - Filters tunnel list by user/container
   - No direct tunnel state management (delegated to inlets server)

3. **Frontend UI** (Claude Web Frontend)
   - Displays list of active tunnels fetched from backend
   - Shows tunnel status and public URLs
   - Real-time updates via polling or WebSocket

## Detailed Design

### 1. Database Schema

No additional database tables are needed. The system will:
- Use existing user-container relationships from the main database
- Query inlets server status API in real-time
- Filter results based on container IDs that belong to the user

### 2. Backend API Endpoints

#### GET /api/config/tunnels
Get tunnel configuration for containers (requires container authentication).

**Response:**
```json
{
    "tunnels_enabled": true,
    "inlets_server_url": "wss://inlets.example.com",
    "inlets_shared_token": "secret-token",
    "tunnel_base_domain": "tunnel.example.com"
}
```

**Implementation:**
- Read configuration from ConfigManager
- Only return if tunnels_enabled is true
- Require valid container authentication token

#### GET /api/tunnels
List all active tunnels for the current user (proxied from inlets server status API).

**Response:**
```json
{
    "tunnels": [
        {
            "hostname": "happy-cloud-1234.tunnel.example.com",
            "public_url": "https://happy-cloud-1234.tunnel.example.com",
            "upstream": "http://localhost:3000",
            "client_id": "container-id-hash",
            "connected_at": "2025-06-21T09:00:00Z",
            "status": "active"
        }
    ]
}
```

**Implementation:**
1. Fetch tunnel list from inlets server status API
2. Filter by container_id/client_id that matches current user's containers
3. Return filtered list

### 3. Container Configuration

Containers will have inlets client pre-installed and configured to:
- Read configuration from backend API at startup
- Auto-connect to inlets server (if enabled in configuration)
- Use container ID as part of the hostname
- Authenticate with the shared token from configuration

Example container startup script:
```bash
#!/bin/bash
# Get tunnel configuration from backend
CONFIG=$(curl -s -H "Authorization: Bearer ${CLAUDE_WEB_AUTH_TOKEN}" \
    "${CLAUDE_WEB_BACKEND_URL}/api/config/tunnels")

if [ "$(echo $CONFIG | jq -r '.tunnels_enabled')" = "true" ]; then
    INLETS_SERVER=$(echo $CONFIG | jq -r '.inlets_server_url')
    INLETS_TOKEN=$(echo $CONFIG | jq -r '.inlets_shared_token')
    # Start inlets client with configuration from database
fi
```

### 4. Frontend UI Components

#### Tunnel List Component
```tsx
interface Tunnel {
    hostname: string;
    public_url: string;
    upstream: string;
    client_id: string;
    connected_at: string;
    status: 'active';
}

const TunnelList: React.FC = () => {
    const [tunnels, setTunnels] = useState<Tunnel[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Poll for updates every 5 seconds
    useEffect(() => {
        const fetchTunnels = async () => {
            try {
                const response = await fetch('/api/tunnels');
                const data = await response.json();
                setTunnels(data.tunnels);
            } catch (error) {
                console.error('Failed to fetch tunnels:', error);
            }
        };
        
        fetchTunnels();
        const interval = setInterval(fetchTunnels, 5000);
        return () => clearInterval(interval);
    }, []);
    
    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Active Tunnels
            </Typography>
            {tunnels.length === 0 ? (
                <Typography color="text.secondary">
                    No active tunnels. Use `claude-tunnel start <port>` in your terminal.
                </Typography>
            ) : (
                <List>
                    {tunnels.map((tunnel, index) => (
                        <ListItem key={index}>
                            <ListItemText
                                primary={`${tunnel.upstream} → ${tunnel.hostname}`}
                                secondary={
                                    <>
                                        <Link href={tunnel.public_url} target="_blank">
                                            {tunnel.public_url}
                                        </Link>
                                        <Typography variant="caption" display="block">
                                            Connected: {formatTime(tunnel.connected_at)}
                                        </Typography>
                                    </>
                                }
                            />
                            <Chip 
                                label="Active" 
                                color="success" 
                                size="small" 
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    );
};
```

## Implementation Plan

### Phase 1: Inlets Server Setup
1. Deploy inlets server on public infrastructure
2. Configure wildcard SSL certificate (*.tunnel.example.com)
3. Enable status API endpoint
4. Configure shared authentication token

### Phase 2: Backend Infrastructure
1. Implement GET /api/tunnels endpoint (proxy to inlets server)
2. Add container ID filtering logic
3. Add authentication and authorization checks
4. Configure inlets server connection settings

### Phase 3: Container Integration
1. Install inlets OSS client in container image
2. Configure inlets client to auto-start (optional)
3. Set up environment variables for inlets connection
4. Test tunnel connectivity

### Phase 4: Frontend UI
1. Create TunnelList component
2. Add to main dashboard
3. Implement polling for updates
4. Add loading states and error handling

### Phase 5: Documentation & Testing
1. Create user documentation
2. Add integration tests
3. Performance testing with multiple tunnels
4. Security audit

## Security Considerations

1. **Authentication**: All API calls require valid user authentication
2. **Authorization**: Users can only manage tunnels for their own containers
3. **Token Security**: Unique tokens per tunnel, stored encrypted
4. **Rate Limiting**: Limit tunnel creation per user (e.g., max 10 tunnels)
5. **Input Validation**: Validate port numbers and protocols
6. **Network Isolation**: Tunnels only expose specified ports

## Configuration

All configuration is managed through the dynamic configuration system in the database:

### Dynamic Configuration Keys

| Configuration Key | Type | Default | Description |
|------------------|------|---------|-------------|
| `tunnels_enabled` | boolean | false | Enable/disable tunnel feature |
| `inlets_server_url` | string | - | Inlets server WebSocket URL (e.g., wss://inlets.example.com) |
| `inlets_status_api_url` | string | - | Inlets server status API endpoint |
| `inlets_shared_token` | string | - | Shared authentication token for all containers |
| `tunnel_base_domain` | string | - | Base domain for tunnel hostnames (e.g., tunnel.example.com) |

### Configuration Management

```bash
# Enable tunnels feature
npm run config:set tunnels_enabled true

# Configure inlets server
npm run config:set inlets_server_url "wss://inlets.example.com"
npm run config:set inlets_status_api_url "https://inlets.example.com/status"
npm run config:set inlets_shared_token "your-secret-token"
npm run config:set tunnel_base_domain "tunnel.example.com"

# View current configuration
npm run config:list -v | grep tunnel
npm run config:list -v | grep inlets
```

### Backend Implementation

```typescript
// Access configuration in backend
const config = await configManager.get();
const tunnelsEnabled = config.tunnels_enabled;
const inletsServerUrl = config.inlets_server_url;
const inletsStatusApiUrl = config.inlets_status_api_url;
```

## Testing Strategy

1. **Unit Tests**:
   - Container ID filtering logic
   - API response parsing
   - Authorization checks

2. **Integration Tests**:
   - API endpoint functionality
   - Inlets server communication
   - User-container filtering

3. **End-to-End Tests**:
   - Tunnel visibility per user
   - Real-time updates
   - Frontend interaction

## Monitoring

1. **Metrics**:
   - Active tunnels count per user
   - API response times
   - Inlets server availability

2. **Alerts**:
   - Inlets server connectivity issues
   - API errors or timeouts
   - Unusual tunnel activity patterns

## Future Enhancements

1. **Custom Domains**: Allow users to use their own domains via CNAME
2. **Multiple Inlets Servers**: Load balancing across multiple inlets servers
3. **Tunnel Metrics**: Display bandwidth usage and connection stats from inlets
4. **Auto-restart**: Supervisor process to restart failed inlets clients
5. **WebSocket Support**: Ensure WebSocket connections work through tunnels
6. **Tunnel Sharing**: Generate temporary shareable links for tunnels