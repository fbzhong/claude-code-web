-- Claude Code Web Database Initialization Script
-- This script creates all necessary tables for a fresh installation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  ssh_public_keys TEXT[],
  ssh_credentials_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for SSH credentials
CREATE INDEX IF NOT EXISTS idx_users_ssh_credentials ON users(id) WHERE ssh_public_keys IS NOT NULL;

-- 2. Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  created_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW(),
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMP,
  expires_at TIMESTAMP,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for invite_codes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active) WHERE is_active = true;

-- 3. Create github_connections table
CREATE TABLE IF NOT EXISTS github_connections (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'bearer',
  scope TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create indexes for github_connections
CREATE INDEX IF NOT EXISTS idx_github_connections_user_id ON github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_github_connections_expires_at ON github_connections(expires_at);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_github_connections_updated_at ON github_connections;
CREATE TRIGGER update_github_connections_updated_at BEFORE UPDATE
  ON github_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Create github_repositories table
CREATE TABLE IF NOT EXISTS github_repositories (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_connection_id INTEGER NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
  repo_id BIGINT NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  repo_full_name VARCHAR(512) NOT NULL,
  repo_owner VARCHAR(255) NOT NULL,
  is_private BOOLEAN DEFAULT false,
  clone_url TEXT NOT NULL,
  ssh_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, repo_id)
);

-- Create index for github_repositories
CREATE INDEX IF NOT EXISTS idx_github_repositories_user_id ON github_repositories(user_id);

-- Create initial invite codes with random values
-- These codes are generated randomly for better security
DO $$
DECLARE
  random_code VARCHAR(12);
  i INTEGER;
BEGIN
  -- Only insert if no invite codes exist yet
  IF NOT EXISTS (SELECT 1 FROM invite_codes LIMIT 1) THEN
    -- Generate 5 random invite codes for initial setup
    FOR i IN 1..5 LOOP
      -- Generate a random 12-character alphanumeric code
      random_code := UPPER(
        SUBSTRING(
          md5(random()::text || clock_timestamp()::text || i::text),
          1,
          12
        )
      );
      
      -- Insert the random code with different max_uses values
      INSERT INTO invite_codes (code, created_by, max_uses, expires_at) VALUES 
        (random_code, 'system', 
         CASE 
           WHEN i <= 2 THEN 5   -- First 2 codes: 5 uses each
           WHEN i <= 4 THEN 10  -- Next 2 codes: 10 uses each
           ELSE 20              -- Last code: 20 uses
         END,
         CURRENT_TIMESTAMP + INTERVAL '30 days'  -- All codes expire in 30 days
        );
    END LOOP;
    
    -- Log the generated codes for initial setup
    RAISE NOTICE 'Generated 5 random invite codes. Use "npm run invite:list" to view them.';
  END IF;
END $$;

-- Grant necessary permissions (adjust based on your database user)
-- Example: GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO claude_web_user;
-- Example: GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO claude_web_user;
-- Example: GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO claude_web_user;

-- Verification queries
SELECT 'Users table created' AS status, COUNT(*) AS count FROM users;
SELECT 'Invite codes table created' AS status, COUNT(*) AS count FROM invite_codes;
SELECT 'GitHub connections table created' AS status, COUNT(*) AS count FROM github_connections;
SELECT 'GitHub repositories table created' AS status, COUNT(*) AS count FROM github_repositories;
