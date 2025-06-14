# Claude Web

Web-based remote development environment for Claude Code and VS Code.

## Features

- 🖥️ Web-based terminal with full TTY support
- 🤖 Claude Code integration and management
- 📝 Command history tracking
- 🔐 User authentication and session management
- 💻 VS Code integration (coming soon)
- 🚀 Real-time WebSocket communication

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 13
- Redis >= 6
- Claude Code installed on the system

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/fbzhong/claude-web.git
   cd claude-web
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up databases**
   ```bash
   # Start PostgreSQL and Redis
   # Create database
   createdb claude_web
   ```

5. **Start development servers**
   ```bash
   pnpm dev
   ```

   This will start:
   - Backend server on http://localhost:3001
   - Frontend server on http://localhost:3000

## Project Structure

```
claude-web/
├── backend/          # Fastify backend server
│   ├── src/
│   │   ├── plugins/  # Fastify plugins
│   │   ├── routes/   # API and WebSocket routes
│   │   ├── services/ # Business logic
│   │   └── types/    # TypeScript types
│   └── tests/        # Backend tests
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   └── stores/     # State management
│   └── public/         # Static assets
└── tests/            # E2E tests
```

## Available Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build for production
- `pnpm test` - Run all tests
- `pnpm lint` - Run linting
- `pnpm type-check` - Run TypeScript type checking

## Development

### Backend Development

The backend uses Fastify with WebSocket support for real-time communication.

```bash
cd backend
pnpm dev
```

### Frontend Development

The frontend uses React with Material-UI and xterm.js.

```bash
cd frontend
pnpm start
```

### Testing

```bash
# Run all tests
pnpm test

# Run backend tests
pnpm --filter backend test

# Run frontend tests
pnpm --filter frontend test
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST/PORT` - Redis connection
- `JWT_SECRET` - Secret for JWT tokens
- `CLAUDE_PATH` - Path to Claude executable

## Security

- JWT-based authentication
- Secure WebSocket connections
- Session isolation
- Rate limiting
- Input validation

## License

Apache License 2.0