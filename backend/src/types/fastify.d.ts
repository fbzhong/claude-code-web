import { User } from './index';
import { SSHConfigManager } from '../services/sshConfigManager';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    pg: any;
    redis: any;
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
    session: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      del: (key: string) => Promise<void>;
    };
  }
}