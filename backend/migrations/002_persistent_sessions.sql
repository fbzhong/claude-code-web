-- Create persistent sessions table
CREATE TABLE IF NOT EXISTS persistent_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Unnamed Session',
    working_dir VARCHAR(500) NOT NULL DEFAULT '/tmp',
    environment JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached', 'dead')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_user_session_name UNIQUE(user_id, name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_persistent_sessions_user_id ON persistent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_persistent_sessions_status ON persistent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_persistent_sessions_last_activity ON persistent_sessions(last_activity);

-- Add session output buffer table for larger output history
CREATE TABLE IF NOT EXISTS session_output_buffer (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES persistent_sessions(id) ON DELETE CASCADE,
    output_data TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sequence_number INTEGER NOT NULL,
    
    UNIQUE(session_id, sequence_number)
);

-- Create index for output buffer
CREATE INDEX IF NOT EXISTS idx_session_output_buffer_session_id ON session_output_buffer(session_id, sequence_number);

-- Update command_history table to reference persistent_sessions
ALTER TABLE command_history 
ADD COLUMN IF NOT EXISTS persistent_session_id UUID REFERENCES persistent_sessions(id) ON DELETE CASCADE;