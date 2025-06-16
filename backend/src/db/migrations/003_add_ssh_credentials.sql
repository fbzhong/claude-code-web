-- Add SSH credentials to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS ssh_public_keys TEXT[],
ADD COLUMN IF NOT EXISTS ssh_credentials_updated_at TIMESTAMP;

-- Create index for SSH credentials
CREATE INDEX IF NOT EXISTS idx_users_ssh_credentials ON users(id) WHERE ssh_public_keys IS NOT NULL;