import { User } from './index';
import { SSHConfigManager } from '../services/sshConfigManager';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    pg: any;
    jwt: {
      sign: (payload: any) => string;
      verify: (token: string) => any;
    };
    sshConfigManager: SSHConfigManager;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: string;
    };
    jwtVerify: () => Promise<any>;
  }
}