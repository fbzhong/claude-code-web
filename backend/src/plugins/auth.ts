import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyInstance } from 'fastify';

export default fp(async function (fastify: FastifyInstance) {
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    sign: {
      expiresIn: '7d'
    }
  });

  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Add user context to request
  fastify.addHook('preHandler', async (request: any) => {
    if (request.headers.authorization) {
      try {
        const payload = await request.jwtVerify();
        request.user = payload;
      } catch (err) {
        // Ignore JWT errors in preHandler, let route handlers decide
      }
    }
  });
});