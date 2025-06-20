-- Configuration settings table
CREATE TABLE IF NOT EXISTS config_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  default_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_config_settings_type ON config_settings(type);

-- Insert default configurations based on existing environment variables
INSERT INTO config_settings (key, value, type, description, default_value) VALUES
  ('max_output_buffer', NULL, 'number', 'Maximum output buffer chunks per session', '5000'),
  ('max_output_buffer_mb', NULL, 'number', 'Maximum output buffer size in MB per session', '5'),
  ('reconnect_history_size', NULL, 'number', 'Number of history chunks to send on reconnect', '500'),
  ('session_timeout_hours', NULL, 'number', 'Hours before inactive sessions are cleaned up', '24'),
  ('cleanup_interval_minutes', NULL, 'number', 'Interval in minutes for running cleanup tasks', '60'),
  ('container_memory_limit', NULL, 'string', 'Memory limit for user containers (e.g., 2g)', '2g'),
  ('container_cpu_limit', NULL, 'number', 'CPU limit for user containers (number of CPUs)', '2'),
  ('require_invite_code', NULL, 'boolean', 'Whether invite code is required for registration', 'false'),
  ('websocket_ping_interval', NULL, 'number', 'WebSocket ping interval in seconds', '30'),
  ('websocket_ping_timeout', NULL, 'number', 'WebSocket ping timeout in seconds', '60'),
  ('container_mode', NULL, 'boolean', 'Whether to use container mode for user isolation', 'false'),
  ('github_client_id', NULL, 'string', 'GitHub OAuth Client ID for GitHub integration', ''),
  ('github_client_secret', NULL, 'string', 'GitHub OAuth Client Secret for GitHub integration', ''),
  ('github_oauth_callback_url', NULL, 'string', 'GitHub OAuth callback URL', '')
ON CONFLICT (key) DO NOTHING;

