-- GitHub OAuth tables
-- Store GitHub connections for users

-- GitHub OAuth apps registered by users
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

-- GitHub repositories connected by users
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

-- Index for faster queries
CREATE INDEX idx_github_repositories_user_id ON github_repositories(user_id);
CREATE INDEX idx_github_connections_user_id ON github_connections(user_id);
CREATE INDEX idx_github_connections_expires_at ON github_connections(expires_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_github_connections_updated_at BEFORE UPDATE
  ON github_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();