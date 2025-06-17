-- Migration: Remove username field
-- Date: 2024-01-17
-- Description: Remove redundant username field, use email as the primary identifier

-- Drop the username column from users table
ALTER TABLE users DROP COLUMN username;

-- Note: This is a breaking change. Ensure all code references to username are updated.