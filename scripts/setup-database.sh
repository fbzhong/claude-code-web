#!/bin/bash

# Database setup script for Claude Web

echo "Setting up Claude Web database..."

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL client not found. Please install PostgreSQL first."
    exit 1
fi

# Default database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-claude_web}"
DB_USER="${DB_USER:-claude_web}"
DB_PASSWORD="${DB_PASSWORD:-claude_web_password}"

# Create database and user
echo "Creating database and user..."
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres <<EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo "Database setup complete!"
echo ""
echo "Database connection string:"
echo "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "Add this to your backend/.env file:"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"