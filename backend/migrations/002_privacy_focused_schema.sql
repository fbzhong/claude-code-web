-- Privacy-focused schema migration
-- Only creates minimal tables for authentication and session management

-- Users table (minimal - only for authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add comments explaining privacy design
COMMENT ON TABLE users IS 'User authentication only - no activity tracking';