import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

export default async function (fastify: FastifyInstance) {
  // Debug endpoint
  fastify.get('/debug/env', async (request, reply) => {
    return {
      CONTAINER_MODE: process.env.CONTAINER_MODE,
      NODE_ENV: process.env.NODE_ENV,
      useContainers: process.env.CONTAINER_MODE === 'true',
      allEnv: Object.keys(process.env).filter(key => key.startsWith('CONTAINER')).reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {} as Record<string, string | undefined>)
    };
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check PostgreSQL
    try {
      const client = await fastify.pg.connect();
      await client.query('SELECT 1');
      
      // Check if required tables exist
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'persistent_sessions')
      `);
      
      const existingTables = tableCheck.rows.map((row: any) => row.table_name);
      const requiredTables = ['users', 'persistent_sessions'];
      const missingTables = requiredTables.filter(t => !existingTables.includes(t));
      
      client.release();
      
      health.services.postgres = {
        status: missingTables.length === 0 ? 'healthy' : 'degraded',
        tables: {
          existing: existingTables,
          missing: missingTables
        }
      };
      
      if (missingTables.length > 0) {
        health.status = 'degraded';
        health.warnings = [`Missing database tables: ${missingTables.join(', ')}`];
      }
    } catch (err: any) {
      health.services.postgres = {
        status: 'unhealthy',
        error: err.message
      };
      health.status = 'unhealthy';
    }

    // Check Redis
    try {
      await fastify.redis.ping();
      health.services.redis = { status: 'healthy' };
    } catch (err: any) {
      health.services.redis = {
        status: 'unhealthy',
        error: err.message
      };
      health.status = 'unhealthy';
    }

    // Check container mode if enabled
    if (process.env.CONTAINER_MODE === 'true') {
      try {
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec('docker version --format "{{.Server.Version}}"', (error: any, stdout: string) => {
            if (error) {
              reject(error);
            } else {
              health.services.docker = {
                status: 'healthy',
                version: stdout.trim()
              };
              resolve(stdout);
            }
          });
        });
      } catch (err: any) {
        health.services.docker = {
          status: 'unhealthy',
          error: 'Docker not accessible'
        };
        health.status = 'degraded';
      }
    }

    const statusCode = health.status === 'ok' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    return reply.status(statusCode).send(health);
  });

  // Auth routes
  fastify.register(async function (fastify) {
    // Login
    fastify.post('/auth/login', {
      schema: {
        body: Type.Object({
          username: Type.String(),
          password: Type.String()
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              token: Type.String(),
              user: Type.Object({
                id: Type.String(),
                username: Type.String(),
                email: Type.String(),
                role: Type.String()
              })
            })
          }),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String()
          })
        }
      }
    }, async (request, reply) => {
      const { username, password } = request.body as { username: string; password: string };
      
      try {
        const client = await fastify.pg.connect();
        const result = await client.query(
          'SELECT * FROM users WHERE username = $1',
          [username]
        );
        client.release();

        if (result.rows.length === 0) {
          return reply.status(401).send({
            success: false,
            error: 'Invalid credentials'
          });
        }

        const user = result.rows[0];
        const bcrypt = require('bcrypt');
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
          return reply.status(401).send({
            success: false,
            error: 'Invalid credentials'
          });
        }

        // PRIVACY: Do not track last login time

        const token = fastify.jwt.sign({
          id: user.id,
          username: user.username,
          role: user.role
        });

        return {
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          }
        };
      } catch (err) {
        fastify.log.error('Login error:', err);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Register
    fastify.post('/auth/register', {
      schema: {
        body: Type.Object({
          username: Type.String({ minLength: 3, maxLength: 50 }),
          email: Type.String({ format: 'email' }),
          password: Type.String({ minLength: 6 })
        })
      }
    }, async (request, reply) => {
      const { username, email, password } = request.body as { username: string; email: string; password: string };
      
      try {
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(password, 10);
        
        const client = await fastify.pg.connect();
        const result = await client.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role',
          [username, email, passwordHash]
        );
        client.release();

        const user = result.rows[0];
        const token = fastify.jwt.sign({
          id: user.id,
          username: user.username,
          role: user.role
        });

        return {
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          }
        };
      } catch (err) {
        if ((err as any).code === '23505') { // Unique violation
          return reply.status(400).send({
            success: false,
            error: 'Username or email already exists'
          });
        }
        
        fastify.log.error('Registration error:', err);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Get current user
    fastify.get('/auth/me', {
      preHandler: [fastify.authenticate]
    }, async (request) => {
      return {
        success: true,
        data: (request as any).user
      };
    });
  });

  // Register sessions routes
  await fastify.register(import('./sessions.js'));
  
  // Register GitHub routes
  await fastify.register(import('./github.js'), { prefix: '/github' });
}