-- Remove session persistence
-- Sessions are now ephemeral and cannot be reattached after disconnect

-- Drop the persistent_sessions table
DROP TABLE IF EXISTS persistent_sessions;

-- Update comment to reflect new architecture
COMMENT ON TABLE users IS 'User authentication only - no session persistence or activity tracking';