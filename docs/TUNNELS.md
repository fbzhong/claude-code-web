# Tunnels Feature Documentation

The Claude Web tunnels feature allows users to expose local services running in their containers to the internet, similar to ngrok. This is powered by [Inlets OSS](https://github.com/inlets/inlets).

## Architecture

- **Inlets Server**: Runs as a Docker container, handles incoming tunnel connections
- **Status API**: Tracks active tunnels and provides API for the backend
- **Container Integration**: Each container has inlets client pre-installed
- **Dynamic Configuration**: All settings stored in database, no hardcoded values

## Quick Start

### 1. Start the Inlets Server

```bash
# For development
./scripts/setup-inlets.sh

# For production
./scripts/setup-inlets.sh prod
```

This will:
- Build and start the inlets server container
- Generate a secure token
- Configure Claude Web to use inlets

### 2. Using Tunnels in Containers

Inside any Claude Web container:

```bash
# Expose a web service on port 3000
tunnel 3000

# Expose a TCP service (e.g., database)
tunnel 5432 tcp
```

The tunnel will be available at:
- Development: `http://[container-id]-[port].tunnel.localhost:8080`
- Production: `https://[container-id]-[port].tunnel.yourdomain.com`

### 3. View Active Tunnels

Active tunnels are displayed in the Claude Web UI:
- Open the sessions drawer (hamburger menu)
- Scroll down to see the "Active Tunnels" section
- Click on tunnel URLs to open them

## Configuration

### Environment Variables

For `docker-compose.yml`:
```yaml
INLETS_TOKEN=your-secure-token          # Authentication token
INLETS_DOMAIN=tunnel.localhost          # Base domain for tunnels
INLETS_CONTROL_PORT=8090               # WebSocket control plane
INLETS_DATA_PORT=8080                  # HTTP data plane
INLETS_STATUS_PORT=8091                # Status API
```

### Dynamic Configuration

Configure via CLI:
```bash
cd backend
npm run config:set tunnels_enabled true
npm run config:set inlets_server_url "ws://localhost:8090"
npm run config:set inlets_status_api_url "http://localhost:8091/status"
npm run config:set inlets_shared_token "your-token"
npm run config:set tunnel_base_domain "tunnel.localhost"
```

## Production Setup

### 1. Domain Configuration

Point a wildcard DNS record to your server:
```
*.tunnel.yourdomain.com → your-server-ip
```

### 2. SSL Certificate

Get a wildcard certificate:
```bash
certbot certonly --manual --preferred-challenges dns \
  -d "*.tunnel.yourdomain.com" \
  -d "tunnel.yourdomain.com"
```

### 3. Nginx Configuration

Use the provided example:
```bash
cp docker/inlets-server/nginx-example.conf /etc/nginx/sites-available/inlets
# Edit the file with your domain
ln -s /etc/nginx/sites-available/inlets /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 4. Update Configuration

```bash
# Update .env.production
INLETS_DOMAIN=tunnel.yourdomain.com
INLETS_TOKEN=your-production-token

# Update database configuration
cd backend
npm run config:set inlets_server_url "wss://inlets.yourdomain.com"
npm run config:set tunnel_base_domain "tunnel.yourdomain.com"
```

## Security Considerations

1. **Token Security**: The inlets token is shared across all containers. Keep it secure.
2. **Network Isolation**: Tunnels only expose specified ports, not the entire container.
3. **User Isolation**: Tunnel list is filtered by user - users only see their own tunnels.
4. **HTTPS**: Always use HTTPS in production with proper SSL certificates.

## Troubleshooting

### Tunnel Not Appearing
1. Check if tunnels are enabled: `npm run config:get tunnels_enabled`
2. Verify inlets server is running: `docker-compose ps inlets`
3. Check container logs: `docker-compose logs inlets`

### Connection Issues
1. Verify token matches between server and client
2. Check firewall rules for ports 8080, 8090, 8091
3. Ensure WebSocket connections are allowed

### Performance
- Each tunnel uses minimal resources
- Status API cleans up inactive tunnels after 1 minute
- Monitor `/data/inlets/tunnels.json` for active tunnels

## Limitations

- Inlets OSS only supports HTTP/HTTPS tunneling (no raw TCP in OSS version)
- No built-in authentication for tunneled services (add your own)
- Subdomains are auto-generated based on container ID and port

## Future Enhancements

- Custom domains per tunnel
- Traffic analytics and bandwidth limits
- Webhook notifications for tunnel events
- Integration with Let's Encrypt for automatic HTTPS