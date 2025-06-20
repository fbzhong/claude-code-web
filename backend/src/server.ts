import "dotenv/config";
import { program } from "commander";
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import authPlugin from "./plugins/auth";
import databasePlugin from "./plugins/database";
import { setupInviteCommands } from "./cli/invite-manager";
import { setupConfigCommands } from './cli/config-manager-cli';

// Check if running as CLI
const isCliMode =
  process.argv.length > 2 &&
  process.argv[2] &&
  !process.argv[2].startsWith("-");

async function createFastifyInstance() {
  const app = Fastify({
    logger: {
      level: "debug",
      transport:
        process.env.NODE_ENV !== "production" && !isCliMode
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register essential plugins for database access
  await app.register(authPlugin);
  await app.register(databasePlugin);

  // Wait for database to be ready
  await app.ready();

  return app;
}

async function runCli() {
  const app = await createFastifyInstance();

  // Setup CLI commands
  setupInviteCommands(app);
  setupConfigCommands(app);

  // Parse CLI arguments
  program.parse(process.argv);

  // If no command was provided, show help
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }

  // Close database connections after command execution
  setTimeout(async () => {
    await app.close();
    process.exit(0);
  }, 100);
}

async function runServer() {
  // Import and start the regular app
  await import("./app");
}

// Main entry point
if (isCliMode) {
  runCli().catch((err) => {
    console.error("CLI Error:", err);
    process.exit(1);
  });
} else {
  runServer().catch((err) => {
    console.error("Server Error:", err);
    process.exit(1);
  });
}
