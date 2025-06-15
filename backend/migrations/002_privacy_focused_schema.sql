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

-- Persistent sessions table (minimal - no command/output history)
CREATE TABLE IF NOT EXISTS persistent_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Session',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached', 'dead')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_persistent_sessions_user_id ON persistent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_persistent_sessions_status ON persistent_sessions(status);

-- Add comments explaining privacy design
COMMENT ON TABLE persistent_sessions IS 'Minimal session metadata only - no command history or output stored for privacy';
COMMENT ON TABLE users IS 'User authentication only - no activity tracking';