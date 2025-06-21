-- Add Inlets configuration settings
INSERT INTO config_settings (key, value, type, description, default_value) VALUES
  ('tunnels_enabled', NULL, 'boolean', 'Enable/disable tunnel feature', 'false'),
  ('inlets_server_url', NULL, 'string', 'Inlets server WebSocket URL (e.g., wss://inlets.example.com)', ''),
  ('inlets_status_api_url', NULL, 'string', 'Inlets server status API endpoint', ''),
  ('inlets_shared_token', NULL, 'string', 'Shared authentication token for all containers', ''),
  ('tunnel_base_domain', NULL, 'string', 'Base domain for tunnel hostnames (e.g., tunnel.example.com)', '')
ON CONFLICT (key) DO NOTHING;