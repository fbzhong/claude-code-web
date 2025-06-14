#!/bin/bash

echo "🚀 Setting up Claude Web development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install Node.js >= 18."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Please install pnpm >= 8."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL is required but not installed. Please install PostgreSQL >= 13."; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { echo "❌ Redis is required but not installed. Please install Redis >= 6."; exit 1; }

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create database
echo "🗄️  Setting up PostgreSQL database..."
createdb claude_web 2>/dev/null || echo "Database 'claude_web' already exists"

# Create test database
createdb claude_web_test 2>/dev/null || echo "Test database 'claude_web_test' already exists"

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Make sure PostgreSQL and Redis are running"
echo "3. Run 'pnpm dev' to start the development servers"
echo ""
echo "Happy coding! 🎉"