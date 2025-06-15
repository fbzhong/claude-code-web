# Database Setup Guide

## Quick Start with Docker Compose

The easiest way to set up the required databases is using Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Manual Database Setup

If you prefer to set up PostgreSQL and Redis manually:

### 1. PostgreSQL Setup

```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Create database and user
./scripts/setup-database.sh
```

### 2. Redis Setup

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis
```

### 3. Environment Configuration

Copy the example environment file and update it:

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

## Database Schema

The application will automatically create the following tables on startup:

1. **users** - User authentication and profile data
2. **persistent_sessions** - Terminal session metadata
3. **session_output_buffer** - Terminal output history
4. **command_history** - Command execution history
5. **claude_processes** - Claude Code process management

## Troubleshooting

### Error: "Failed to save session to database"

This error indicates the `persistent_sessions` table is missing. The application should create it automatically on startup, but if it doesn't:

1. Check your database connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. Manually create the tables:
   ```bash
   psql $DATABASE_URL < backend/migrations/002_persistent_sessions.sql
   ```

### Error: "Failed to save output buffer to database"

Similar to above, this indicates the `session_output_buffer` table is missing. Follow the same steps to resolve.

### Connection Refused

If you get connection errors:

1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgresql
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Check if Redis is running:
   ```bash
   # macOS
   brew services list | grep redis
   
   # Linux
   sudo systemctl status redis
   ```

3. Verify your connection string in `.env`

### Permission Denied

If you get permission errors, ensure the database user has proper privileges:

```sql
GRANT ALL PRIVILEGES ON DATABASE claude_web TO claude_web;
GRANT ALL ON SCHEMA public TO claude_web;
```

## Development vs Production

- **Development**: Use local PostgreSQL and Redis instances
- **Production**: Use Docker Compose or managed database services (AWS RDS, ElastiCache, etc.)

For production, ensure you:
1. Use strong passwords
2. Enable SSL/TLS for database connections
3. Set up regular backups
4. Monitor database performance