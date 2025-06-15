-- Privacy cleanup migration
-- This removes sensitive data storage tables

-- Drop tables that store sensitive user data
DROP TABLE IF EXISTS command_history CASCADE;
DROP TABLE IF EXISTS session_output_buffer CASCADE;
DROP TABLE IF EXISTS terminal_sessions CASCADE;
DROP TABLE IF EXISTS claude_processes CASCADE;

-- Remove sensitive columns from persistent_sessions
ALTER TABLE persistent_sessions 
  DROP COLUMN IF EXISTS working_dir,
  DROP COLUMN IF EXISTS environment;

-- Add comment explaining privacy design
COMMENT ON TABLE persistent_sessions IS 'Minimal session metadata only - no command history or output stored for privacy';
COMMENT ON TABLE users IS 'User authentication only - no activity tracking';