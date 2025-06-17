import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SSHConfigManager } from '../../services/sshConfigManager.js';

export default async function (fastify: FastifyInstance) {
  const sshConfigManager = new SSHConfigManager(fastify);

  // SSH registration endpoint for containers
  fastify.post('/ssh/register', {
    schema: {
      body: Type.Object({
        containerId: Type.String(),
        containerName: Type.String(),
        userId: Type.String(),
        publicKey: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            username: Type.String(),
            registered: Type.Boolean()
          })
        }),
        400: Type.Object({
          success: Type.Boolean(),
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { containerId, containerName, userId, publicKey } = request.body as {
      containerId: string;
      containerName: string;
      userId: string;
      publicKey?: string;
    };

    try {
      // Validate container belongs to user (security check)
      // In production, you'd want to verify the container is actually owned by this user
      const expectedContainerName = `claude-web-user-${userId}`;
      if (containerName !== expectedContainerName) {
        return reply.status(403).send({
          success: false,
          error: 'Container name does not match user ID'
        });
      }

      // Add SSH route
      await sshConfigManager.addUserRoute(userId, containerName);

      // If public key provided, store it (for future use)
      if (publicKey) {
        // TODO: Store public key for user authentication
        fastify.log.info(`Public key provided for user ${userId}`);
      }

      const username = `user${userId}`;
      fastify.log.info(`SSH route registered: ${username} -> ${containerName}`);

      return {
        success: true,
        data: {
          username,
          registered: true
        }
      };
    } catch (err) {
      fastify.log.error('SSH registration error:', err);
      return reply.status(500).send({
        success: false,
        error: 'Failed to register SSH route'
      });
    }
  });

  // Get SSH connection info (already exists, but let's add it here too)
  fastify.get('/ssh/info', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const username = `user${user.id}`;
      
      // Check if container exists and SSH is configured
      const containerName = `claude-web-user-${user.id}`;
      
      // For container mode, always return the info as container should be running
      if (process.env.CONTAINER_MODE === 'true') {
        return {
          success: true,
          data: {
            username,
            hostname: 'localhost',
            port: 2222,
            containerName,
            connectionCommand: `ssh ${username}@localhost -p 2222`
          }
        };
      }
      
      return reply.status(404).send({
        success: false,
        error: 'SSH not available in non-container mode'
      });
    } catch (err) {
      fastify.log.error('Failed to get SSH info:', err);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve SSH connection information'
      });
    }
  });

  // Check SSH registration status
  fastify.get('/ssh/status/:userId', {
    schema: {
      params: Type.Object({
        userId: Type.String()
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            registered: Type.Boolean(),
            username: Type.String(),
            containerName: Type.Optional(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      const username = `user${userId}`;
      const containerName = `claude-web-user-${userId}`;
      
      // Check if route exists
      const routes = await sshConfigManager.listRoutes();
      const isRegistered = routes.includes(username);

      return {
        success: true,
        data: {
          registered: isRegistered,
          username,
          containerName: isRegistered ? containerName : undefined
        }
      };
    } catch (err) {
      fastify.log.error('SSH status check error:', err);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check SSH registration status'
      });
    }
  });
}