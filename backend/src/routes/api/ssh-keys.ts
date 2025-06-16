import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

export default async function (fastify: FastifyInstance) {
  
  // Get user's SSH public keys
  fastify.get('/ssh-keys', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    
    try {
      const client = await fastify.pg.connect();
      const result = await client.query(
        'SELECT ssh_public_keys FROM users WHERE id = $1',
        [user.id]
      );
      client.release();
      
      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }
      
      const userData = result.rows[0];
      
      // Ensure workingDir structure exists and authorized_keys is in sync
      try {
        const sshConfigManager = fastify.sshConfigManager;
        if (sshConfigManager) {
          // This will create the workingDir if it doesn't exist and restore authorized_keys from DB
          await sshConfigManager.ensureUserWorkingDir(user.id);
          fastify.log.info(`[SSH-Keys] Ensured workingDir for user ${user.id}`);
        }
      } catch (sshError) {
        fastify.log.warn(`[SSH-Keys] Failed to ensure workingDir: ${sshError}`);
        // Don't fail the request, just log the warning
      }
      
      return {
        success: true,
        data: {
          sshPublicKeys: userData.ssh_public_keys || [],
          sshUsername: `u${user.id.replace(/-/g, '').substring(0, 8)}`,
          sshHost: process.env.SSH_HOST || 'localhost',
          sshPort: 2222
        }
      };
    } catch (error) {
      fastify.log.error('Failed to get SSH keys:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve SSH keys'
      });
    }
  });

  // Add SSH public key
  fastify.post('/ssh-keys', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        publicKey: Type.String({ minLength: 1 }),
        name: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const user = (request as any).user;
    const { publicKey, name } = request.body as { publicKey: string; name?: string };
    
    // Validate SSH public key format
    const sshKeyRegex = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|ssh-dss)\s+[A-Za-z0-9+/]+[=]{0,2}(\s+.+)?$/;
    if (!sshKeyRegex.test(publicKey.trim())) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid SSH public key format'
      });
    }
    
    try {
      const client = await fastify.pg.connect();
      
      // Get current keys
      const currentResult = await client.query(
        'SELECT ssh_public_keys FROM users WHERE id = $1',
        [user.id]
      );
      
      const currentKeys = currentResult.rows[0]?.ssh_public_keys || [];
      
      // Check if key already exists
      if (currentKeys.includes(publicKey.trim())) {
        client.release();
        return reply.status(400).send({
          success: false,
          error: 'This SSH key is already added'
        });
      }
      
      // Add new key
      const updatedKeys = [...currentKeys, publicKey.trim()];
      
      await client.query(
        'UPDATE users SET ssh_public_keys = $1 WHERE id = $2',
        [updatedKeys, user.id]
      );
      
      client.release();
      
      // Update SSHpiper workingDir authorized_keys
      try {
        const sshConfigManager = fastify.sshConfigManager;
        if (!sshConfigManager) {
          fastify.log.error('[SSH-Keys] sshConfigManager is not initialized');
          throw new Error('SSH configuration manager not available');
        }
        await sshConfigManager.updateUserAuthorizedKeys(user.id, updatedKeys);
        fastify.log.info(`[SSH-Keys] Updated workingDir for user ${user.id}`);
      } catch (sshError) {
        fastify.log.error(`[SSH-Keys] Failed to update SSH config: ${sshError}`);
        // Don't fail the entire operation, but log the error
      }
      
      return {
        success: true,
        data: {
          message: 'SSH public key added successfully',
          totalKeys: updatedKeys.length
        }
      };
    } catch (error) {
      fastify.log.error('Failed to add SSH key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to add SSH key'
      });
    }
  });

  // Delete SSH public key
  fastify.delete('/ssh-keys/:keyIndex', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        keyIndex: Type.Integer({ minimum: 0 })
      })
    }
  }, async (request, reply) => {
    const user = (request as any).user;
    const { keyIndex } = request.params as { keyIndex: number };
    
    try {
      const client = await fastify.pg.connect();
      
      // Get current keys
      const currentResult = await client.query(
        'SELECT ssh_public_keys FROM users WHERE id = $1',
        [user.id]
      );
      
      const currentKeys = currentResult.rows[0]?.ssh_public_keys || [];
      
      if (keyIndex >= currentKeys.length) {
        client.release();
        return reply.status(404).send({
          success: false,
          error: 'SSH key not found'
        });
      }
      
      // Remove key
      const updatedKeys = currentKeys.filter((_, index) => index !== keyIndex);
      
      await client.query(
        'UPDATE users SET ssh_public_keys = $1 WHERE id = $2',
        [updatedKeys, user.id]
      );
      
      client.release();
      
      // Update SSHpiper workingDir authorized_keys
      try {
        const sshConfigManager = fastify.sshConfigManager;
        if (!sshConfigManager) {
          fastify.log.error('[SSH-Keys] sshConfigManager is not initialized');
          throw new Error('SSH configuration manager not available');
        }
        await sshConfigManager.updateUserAuthorizedKeys(user.id, updatedKeys);
        fastify.log.info(`[SSH-Keys] Updated workingDir for user ${user.id}`);
      } catch (sshError) {
        fastify.log.error(`[SSH-Keys] Failed to update SSH config: ${sshError}`);
        // Don't fail the entire operation, but log the error
      }
      
      return {
        success: true,
        data: {
          message: 'SSH public key removed successfully',
          totalKeys: updatedKeys.length
        }
      };
    } catch (error) {
      fastify.log.error('Failed to remove SSH key:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to remove SSH key'
      });
    }
  });
}