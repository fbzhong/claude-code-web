-- Remove SSH password fields as we only support public key authentication
ALTER TABLE users 
DROP COLUMN IF EXISTS ssh_password,
DROP COLUMN IF EXISTS ssh_password_hash;

-- Note: ssh_public_keys field is still needed for storing user's public keys
-- These keys are synced to SSHpiper workingDir for authentication