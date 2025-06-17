# Claude Web

A web-based remote development environment that allows users to access and control Claude Code and VS Code on remote servers through their browsers.

## Key Features

- 🌐 **Web Terminal**: Full terminal experience based on xterm.js
- 🔒 **Container Isolation**: Independent Docker container for each user
- 💻 **IDE Integration**: One-click connection to VS Code, Cursor, Windsurf
- 🔑 **SSH Access**: Secure SSH connections via SSHpiper
- 🐙 **GitHub Integration**: OAuth integration for repository management
- 📱 **Mobile Support**: Responsive design with virtual keyboard
- 🎯 **Session Management**: Multi-session support with real-time updates
- 🎟️ **Invite System**: Optional invite code registration control

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (LTS) and npm (for development)
- PostgreSQL (included in Docker setup)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/fbzhong/claude-web.git
cd claude-web
```

2. **Configure environment**

```bash
cp .env.production.example .env
# Edit .env file with your configuration
```

3. **Deploy with Docker**

```bash
./scripts/deploy.sh
```

## Development Setup

### Local Development

1. **Install dependencies**

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

2. **Setup database**

```bash
# Start PostgreSQL
docker compose up -d postgres

# Run migrations
psql -U claude_web -d claude_web -f scripts/init-db.sql
```

3. **Configure environment**

```bash
# Backend
cd backend
cp .env.example .env
# Edit backend/.env

# Frontend
cd ../frontend
cp .env.example .env
# Edit frontend/.env
```

4. **Start development servers**

```bash
# Terminal 1: Backend (port 12021)
cd backend && npm run dev

# Terminal 2: Frontend (port 12020)
cd frontend && npm start
```

### Project Structure

```
claude-web/
├── backend/          # Fastify API server
├── frontend/         # React application
├── containers/dev/   # User development container
├── scripts/          # Deployment and utility scripts
├── sshpiper/        # SSH proxy configuration
└── docs/            # Documentation
```

## Production Deployment

### Using Docker Compose

1. **Prepare environment**

```bash
# Copy and configure environment variables
cp .env.production.example .env
vim .env

# Required variables:
# - POSTGRES_PASSWORD
# - JWT_SECRET (generate: openssl rand -base64 32)
# - ENCRYPTION_KEY (generate: openssl rand -base64 32)
# - GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET
```

2. **Build development container (first time only)**

```bash
SCRIPT_DIR="$(dirname "$0")"
"${SCRIPT_DIR}/rebuild-dev-image.sh"
```

3. **Deploy services**

```bash
# Build and start all services
./scripts/deploy.sh

# Or manually:
docker compose -f docker-compose.prod.yml up -d
```

4. **Create invite codes (if enabled)**

```bash
docker exec claude-web-backend npm run invite:create -- --count 10
```

### Service Ports

- Frontend: `http://localhost:12020`
- Backend API: `http://localhost:12021`
- SSH: `ssh username@localhost -p 2222`

### HTTPS Configuration (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:12020;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:12021;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Usage Guide

### For Users

1. **Register/Login**
   - Visit `http://your-domain.com`
   - Sign up with email and password
   - Enter invite code if required

2. **Using Web Terminal**
   - Click "New Session" to create a terminal
   - Run `claude` to start Claude Code
   - Use like a regular terminal

3. **Connecting IDE**
   - Go to Settings → SSH Keys
   - Upload your SSH public key
   - Click "Open in VS Code/Cursor/Windsurf"
   - Or manually: `ssh your-email@your-domain.com -p 2222`

4. **GitHub Integration**
   - Connect GitHub account in Settings
   - Clone private repos with one click
   - Automatic token management

### For Administrators

#### Managing Invite Codes

```bash
# Create invite codes
docker exec claude-web-backend npm run invite:create -- --count 5

# List codes
docker exec claude-web-backend npm run invite:list

# Delete code
docker exec claude-web-backend npm run invite:delete CODE123
```

#### Monitoring

```bash
# View service status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Monitor resources
docker stats --filter "name=claude-web"
```

#### Maintenance

```bash
# Backup database
docker exec claude-web-postgres pg_dump -U claude_web claude_web > backup.sql

# Update deployment
git pull
./scripts/deploy.sh

# Clean up old containers
docker exec claude-web-backend npm run cleanup:containers
```

## Architecture

### Technology Stack

- **Frontend**: React + TypeScript + Material-UI + xterm.js
- **Backend**: Fastify + WebSocket + node-pty/dockerode
- **Database**: PostgreSQL (users, sessions, GitHub connections)
- **Container**: Docker/Podman with isolated user environments
- **IDE Integration**: SSHpiper for Remote-SSH protocol
- **Authentication**: JWT + bcrypt

### Security Features

- Container isolation per user
- SSH public key authentication only
- JWT token authentication
- Encrypted sensitive data
- No command history storage
- Invite code registration control

## Environment Variables

See [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) for complete configuration guide.

Key variables:

- `JWT_SECRET`: JWT signing key
- `ENCRYPTION_KEY`: Data encryption key
- `GITHUB_CLIENT_ID/SECRET`: GitHub OAuth credentials
- `CONTAINER_MEMORY_LIMIT`: Memory limit per user (default: 2g)
- `REQUIRE_INVITE_CODE`: Enable invite system
- `SSHPIPER_DIR`: Base directory for SSHpiper files

## Development

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Building for Production

```bash
# Build backend
cd backend && npm run build

# Build frontend
cd frontend && npm run build

# Build Docker images
docker compose -f docker-compose.prod.yml build
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project decisions and technical details
- [FEATURE.md](./FEATURE.md) - Feature requirements
- [Environment Variables](./docs/ENVIRONMENT_VARIABLES.md) - Configuration guide

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- Issues: [GitHub Issues](https://github.com/fbzhong/claude-web/issues)
- Discussions: [GitHub Discussions](https://github.com/fbzhong/claude-web/discussions)
