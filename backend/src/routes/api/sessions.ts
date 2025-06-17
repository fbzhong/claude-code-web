import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SessionManager, SessionInfo } from "../../services/sessionManager";

interface CreateSessionRequest {
  name?: string;
  workingDir?: string;
  environment?: Record<string, string>;
}

interface AttachSessionRequest {
  sessionId: string;
}

interface SessionParams {
  sessionId: string;
}

export default async function sessionsRoutes(fastify: FastifyInstance) {
  const sessionManager = SessionManager.getInstance(fastify);

  // Get all user sessions
  fastify.get(
    "/sessions",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const sessions = sessionManager.getUserSessions(user.id);

        return {
          success: true,
          data: sessions.filter((s) => s.status !== "dead"),
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to get sessions:", error);
        return reply.status(500).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Create new session
  fastify.post<{ Body: CreateSessionRequest }>(
    "/sessions",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            workingDir: { type: "string" },
            environment: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { name, workingDir, environment } = request.body;

        const session = await sessionManager.createSession(user.id, {
          name,
          workingDir,
          environment,
        });

        return {
          success: true,
          data: {
            id: session.id,
            name: session.name,
            status: session.status,
            workingDir: session.workingDir,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity || session.createdAt,
            connectedClients: session.connectedClients || 0,
            outputPreview: "",
          },
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to create session:", error);
        return reply.status(400).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Get specific session info
  fastify.get<{ Params: SessionParams }>(
    "/sessions/:sessionId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { sessionId } = request.params;

        const session = sessionManager.getSession(sessionId);

        if (!session) {
          return reply.status(404).send({
            success: false,
            error: "Session not found",
            timestamp: new Date(),
          });
        }

        if (session.userId !== user.id) {
          return reply.status(403).send({
            success: false,
            error: "Access denied",
            timestamp: new Date(),
          });
        }

        return {
          success: true,
          data: {
            id: session.id,
            name: session.name,
            status: session.status,
            workingDir: session.workingDir,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            connectedClients: session.connectedClients,
          },
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to get session:", error);
        return reply.status(500).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Get session output
  fastify.get<{
    Params: SessionParams;
    Querystring: { lines?: number };
  }>(
    "/sessions/:sessionId/output",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { sessionId } = request.params;
        const { lines } = request.query;

        const session = sessionManager.getSession(sessionId);

        if (!session) {
          return reply.status(404).send({
            success: false,
            error: "Session not found",
            timestamp: new Date(),
          });
        }

        if (session.userId !== user.id) {
          return reply.status(403).send({
            success: false,
            error: "Access denied",
            timestamp: new Date(),
          });
        }

        const output = sessionManager.getSessionOutput(sessionId, lines);

        return {
          success: true,
          data: {
            sessionId,
            output,
            totalLines: session.outputBuffer.length,
          },
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to get session output:", error);
        return reply.status(500).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Attach to session (for WebSocket)
  fastify.post<{ Body: AttachSessionRequest }>(
    "/sessions/attach",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { sessionId } = request.body;

        const session = await sessionManager.attachToSession(
          sessionId,
          user.id
        );

        return {
          success: true,
          data: {
            id: session.id,
            name: session.name,
            status: session.status,
            workingDir: session.workingDir,
            connectedClients: session.connectedClients,
          },
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to attach to session:", error);
        return reply.status(400).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Delete session
  fastify.delete<{ Params: SessionParams }>(
    "/sessions/:sessionId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { sessionId } = request.params;

        const success = await sessionManager.killSession(sessionId, user.id);

        if (!success) {
          return reply.status(404).send({
            success: false,
            error: "Session not found or access denied",
            timestamp: new Date(),
          });
        }

        return {
          success: true,
          data: { sessionId, deleted: true },
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to delete session:", error);
        return reply.status(500).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Rename session
  fastify.patch<{
    Params: SessionParams;
    Body: { name: string };
  }>(
    "/sessions/:sessionId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { sessionId } = request.params;
        const { name } = request.body;

        const session = sessionManager.getSession(sessionId);

        if (!session) {
          return reply.status(404).send({
            success: false,
            error: "Session not found",
            timestamp: new Date(),
          });
        }

        if (session.userId !== user.id) {
          return reply.status(403).send({
            success: false,
            error: "Access denied",
            timestamp: new Date(),
          });
        }

        session.name = name;

        return {
          success: true,
          data: {
            id: session.id,
            name: session.name,
            status: session.status,
          },
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to rename session:", error);
        return reply.status(500).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Get SSH connection information
  fastify.get(
    "/ssh-info",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const containerManager = (fastify as any).containerManager;

        if (!containerManager) {
          return reply.status(503).send({
            success: false,
            error: "Container service not available",
            timestamp: new Date(),
          });
        }

        const sshInfo = containerManager.getSSHConnectionInfo(user.id);

        return {
          success: true,
          data: sshInfo,
          timestamp: new Date(),
        };
      } catch (error: any) {
        fastify.log.error("Failed to get SSH info:", error);
        return reply.status(500).send({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }
  );

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await sessionManager.shutdown();
  });
}
