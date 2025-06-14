import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

export default async function (fastify: FastifyInstance) {
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

        // Update last login
        const updateClient = await fastify.pg.connect();
        await updateClient.query(
          'UPDATE users SET last_login = NOW() WHERE id = $1',
          [user.id]
        );
        updateClient.release();

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
}