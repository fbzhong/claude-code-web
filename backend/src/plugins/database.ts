import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

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

  // Database initialization
  fastify.addHook('onReady', async function () {
    // Create tables if they don't exist
    const client = await fastify.pg.connect();
    
    try {
      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP
        )
      `);

      // Terminal sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS terminal_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          working_dir VARCHAR(500) DEFAULT '/tmp',
          environment JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          last_activity TIMESTAMP DEFAULT NOW()
        )
      `);

      // Command history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS command_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES terminal_sessions(id) ON DELETE CASCADE,
          command TEXT NOT NULL,
          output TEXT,
          exit_code INTEGER,
          timestamp TIMESTAMP DEFAULT NOW(),
          duration INTEGER DEFAULT 0
        )
      `);

      // Claude processes table
      await client.query(`
        CREATE TABLE IF NOT EXISTS claude_processes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES terminal_sessions(id) ON DELETE CASCADE,
          pid INTEGER,
          status VARCHAR(20) DEFAULT 'stopped',
          started_at TIMESTAMP,
          config JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      fastify.log.info('Database initialized successfully');
    } catch (err) {
      fastify.log.error('Database initialization failed:', err);
    } finally {
      client.release();
    }
  });
});