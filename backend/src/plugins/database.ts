import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { SSHConfigManager } from '../services/sshConfigManager';

export default fp(async function (fastify: FastifyInstance) {
  // PostgreSQL connection
  await fastify.register((await import('@fastify/postgres')).default, {
    connectionString: process.env.DATABASE_URL || 'postgresql://fbzhong@localhost:5432/claude_web'
  });

  // Database initialization - MINIMAL TABLES FOR PRIVACY
  fastify.addHook('onReady', async function () {
    // Create tables if they don't exist
    const client = await fastify.pg.connect();
    
    try {
      // Users table - with email for authentication
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Invite codes table
      await client.query(`
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
        )
      `);

      // Create index for invite codes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active) WHERE is_active = true`);

      // Note: Sessions are now fully ephemeral
      // We do NOT store any session data:
      // - No session persistence
      // - No command history
      // - No terminal output
      // - No working directories
      // - No environment variables
      // - No user activity logs
      // We only keep minimal data needed for authentication

      // Configuration settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS config_settings (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT,
          type VARCHAR(50) NOT NULL DEFAULT 'string',
          description TEXT,
          default_value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Index for faster lookups
      await client.query(`CREATE INDEX IF NOT EXISTS idx_config_settings_type ON config_settings(type)`);

      // Insert default configurations if they don't exist
      await client.query(`
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
          ('websocket_ping_timeout', NULL, 'number', 'WebSocket ping timeout in seconds', '60')
        ON CONFLICT (key) DO NOTHING
      `);

      // Audit log for configuration changes
      await client.query(`
        CREATE TABLE IF NOT EXISTS config_audit_log (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_by VARCHAR(255),
          change_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Index for audit log queries
      await client.query(`CREATE INDEX IF NOT EXISTS idx_config_audit_log_key ON config_audit_log(key)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_config_audit_log_created_at ON config_audit_log(created_at)`);

      fastify.log.info('Database initialized successfully with minimal tables for privacy');
    } catch (err) {
      fastify.log.error('Database initialization failed:', err);
    } finally {
      client.release();
    }
    
    // Initialize SSH Configuration Manager
    try {
      const sshConfigManager = new SSHConfigManager(fastify);
      await sshConfigManager.initialize();
      
      // Attach to fastify instance for use in routes
      fastify.decorate('sshConfigManager', sshConfigManager);
      
      fastify.log.info('SSHConfigManager initialized successfully');
    } catch (err) {
      fastify.log.error('SSHConfigManager initialization failed:', err);
      // Don't fail the entire app if SSH config fails - some features may still work
    }
  });
});