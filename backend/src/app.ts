import "dotenv/config";
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import authPlugin from "./plugins/auth";
import databasePlugin from "./plugins/database";
import apiRoutes from "./routes/api";
import wsRoutes from "./routes/ws";

const app = Fastify({
  logger: {
    level: "debug",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
              errorProps: "error,err,stack",
              messageFormat: "{msg} {error}",
              singleLine: false,
            },
          }
        : undefined,
    serializers: {
      err(error: any) {
        return {
          type: error.type,
          message: error.message,
          stack: error.stack,
          code: error.code,
          ...error,
        };
      },
    },
  },
}).withTypeProvider<TypeBoxTypeProvider>();

const start = async () => {
  try {
    // Register plugins
    await app.register(helmet, {
      contentSecurityPolicy: false,
    });

    await app.register(cors, {
      origin:
        process.env.NODE_ENV === "production"
          ? ["https://your-domain.com"]
          : true,
      credentials: true,
    });

    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
    });

    await app.register(websocket);

    // Register custom plugins
    await app.register(authPlugin);
    await app.register(databasePlugin);

    // Register routes
    await app.register(apiRoutes, { prefix: "/api" });
    await app.register(wsRoutes, { prefix: "/ws" });

    // Health check route
    app.get("/health", async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    });

    // Start server
    const port = parseInt(process.env.PORT || "12021", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  app.log.info("SIGTERM received, shutting down gracefully");
  await app.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  app.log.info("SIGINT received, shutting down gracefully");
  await app.close();
  process.exit(0);
});

start();

export default app;
