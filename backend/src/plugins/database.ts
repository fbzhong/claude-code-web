import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { SSHConfigManager } from '../services/sshConfigManager';

export default fp(async function (fastify: FastifyInstance) {
  // PostgreSQL connection
  await fastify.register((await import('@fastify/postgres')).default, {
    connectionString: process.env.DATABASE_URL || 'postgresql://fbzhong@localhost:5432/claude_web'
  });

  // Redis connection
  await fastify.register((await import('@fastify/redis')).default, {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD
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
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Persistent sessions table - MINIMAL: no command history or output
      await client.query(`
        CREATE TABLE IF NOT EXISTS persistent_sessions (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL DEFAULT 'Session',
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached', 'dead')),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      // Create indexes for persistent_sessions
      await client.query(`CREATE INDEX IF NOT EXISTS idx_persistent_sessions_user_id ON persistent_sessions(user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_persistent_sessions_status ON persistent_sessions(status)`);

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

      // Note: We do NOT store:
      // - Command history
      // - Terminal output
      // - Working directories
      // - Environment variables
      // - Any user activity logs
      // We only keep minimal data needed for authentication and session management

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