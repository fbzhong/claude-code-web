import { User } from './index';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    pg: any;
    redis: any;
    jwt: {
      sign: (payload: any) => string;
      verify: (token: string) => any;
    };
  }

  interface FastifyRequest {
    user?: {
      id: string;
      username: string;
      role: string;
    };
    jwtVerify: () => Promise<any>;
  }
}