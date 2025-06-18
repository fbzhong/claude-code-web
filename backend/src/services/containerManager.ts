import { EventEmitter } from "events";
import Docker = require("dockerode");
import { SSHConfigManager } from "./sshConfigManager";
import { Readable, Writable } from "stream";

export interface ContainerConfig {
  image: string;
  name: string;
  userId: string;
  memory?: string;
  cpu?: string;
  environment?: Record<string, string>;
  volumes?: string[];
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  created: Date;
  image: string;
}

export interface ExecSession {
  exec: Docker.Exec;
  stream: NodeJS.ReadWriteStream;
  resize: (rows: number, cols: number) => Promise<void>;
  kill: () => void;
}

export class ContainerManager extends EventEmitter {
  private docker: Docker;
  private defaultImage: string;
  private cleanupInterval?: NodeJS.Timeout;
  private networkName = process.env.CONTAINER_NETWORK || undefined;

  private get sshConfigManager(): SSHConfigManager {
    if (!this.fastify.sshConfigManager) {
      throw new Error(
        "SSHConfigManager not initialized. Make sure database plugin is loaded first."
      );
    }
    return this.fastify.sshConfigManager;
  }

  constructor(private fastify: any) {
    super();

    // Initialize Docker client
    const dockerHost = process.env.CONTAINER_HOST;
    if (dockerHost && dockerHost.startsWith("unix://")) {
      // Unix socket
      const socketPath = dockerHost.replace("unix://", "");
      this.docker = new Docker({ socketPath });
      this.fastify.log.info(`Using Docker daemon at ${dockerHost}`);
    } else if (dockerHost && dockerHost.includes("://")) {
      // Support remote Docker daemon
      const url = new URL(dockerHost);
      this.docker = new Docker({
        host: url.hostname,
        port: url.port || "2375",
        protocol: url.protocol.replace(":", "") as "http" | "https",
      });
      this.fastify.log.info(`Using remote Docker daemon at ${dockerHost}`);
    } else {
      // Use default local Docker daemon
      this.docker = new Docker();
      this.fastify.log.info("Using local Docker daemon");
    }

    // Use custom image if specified, otherwise use default
    this.defaultImage = process.env.CONTAINER_IMAGE || "claude-web-dev:latest";

    this.fastify.log.info(`Using container image: ${this.defaultImage}`);

    // Start periodic cleanup of inactive containers
    this.startPeriodicCleanup();
  }

  /**
   * Get or create a container for a user
   */
  async getOrCreateUserContainer(userId: string): Promise<string> {
    const containerName = `claude-web-user-${userId}`;

    this.fastify.log.info(
      `[ContainerManager] Getting or creating container for user ${userId}, name: ${containerName}`
    );

    try {
      // Check if container exists
      const existingContainer = await this.getContainer(containerName);
      if (existingContainer) {
        this.fastify.log.info(
          `[ContainerManager] Found existing container ${existingContainer.id} with status: ${existingContainer.status}`
        );

        // Ensure it's running
        if (existingContainer.status !== "running") {
          this.fastify.log.info(
            `[ContainerManager] Starting existing container ${existingContainer.id}`
          );
          const container = this.docker.getContainer(existingContainer.id);
          await container.start();
        }

        return existingContainer.id;
      }

      // Create new container
      this.fastify.log.info(
        `[ContainerManager] No existing container found, creating new one...`
      );

      const containerConfig = {
        image: this.defaultImage,
        name: containerName,
        userId,
        memory: process.env.CONTAINER_MEMORY_LIMIT || "2g",
        cpu: process.env.CONTAINER_CPU_LIMIT || "1",
        environment: {
          USER: "developer",
          HOME: "/home/developer",
          TERM: "xterm-256color",
          LANG: "en_US.UTF-8",
          USER_ID: userId,
        },
        volumes: [`claude-web-user-${userId}-data:/home/developer`],
      };

      const containerId = await this.createContainer(containerConfig);

      // Start the container
      this.fastify.log.info(
        `[ContainerManager] Starting container ${containerId}`
      );
      const container = this.docker.getContainer(containerId);
      await container.start();

      // Register SSH route for the container
      try {
        await this.sshConfigManager.addUserRoute(userId, containerName);
        this.fastify.log.info(
          `[ContainerManager] SSH route registered for user ${userId}`
        );
      } catch (error) {
        this.fastify.log.warn(
          `[ContainerManager] Failed to register SSH route: ${error}`
        );
      }

      this.fastify.log.info(
        `[ContainerManager] Successfully created and initialized container ${containerId}`
      );
      return containerId;
    } catch (error: any) {
      this.fastify.log.error(
        `[ContainerManager] Failed to get/create container for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create an interactive exec session in a container
   */
  async createExecSession(
    containerId: string,
    options: {
      cmd?: string[];
      workingDir?: string;
      user?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<ExecSession> {
    const container = this.docker.getContainer(containerId);

    // Create exec instance
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: options.cmd || ["/bin/bash"],
      User: options.user || "developer",
      WorkingDir: options.workingDir || "/home/developer",
      Env: options.env
        ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
        : undefined,
    });

    // Start exec - when Tty is true, we get a single stream
    // When Tty is false, stdout/stderr are multiplexed
    this.fastify.log.info(`[ContainerManager] Starting exec session with hijack...`);
    const execResult = await exec.start({
      hijack: true,
      stdin: true,
    });

    // The stream is the raw socket when using hijack
    const stream = execResult as NodeJS.ReadWriteStream;
    this.fastify.log.info(`[ContainerManager] Exec session started, stream type: ${stream.constructor.name}`);

    // Create resize function
    const resize = async (rows: number, cols: number) => {
      try {
        // this.fastify.log.debug(`resize:  ${rows} x ${cols}`);
        await exec.resize({ h: rows, w: cols });
      } catch (error) {
        this.fastify.log.warn(`Failed to resize exec session: ${error}`);
      }
    };

    // Create kill function
    const kill = () => {
      if ("destroy" in stream && typeof stream.destroy === "function") {
        stream.destroy();
      } else {
        // Fallback for streams without destroy method
        stream.end();
      }
    };

    return {
      exec,
      stream,
      resize,
      kill,
    };
  }

  /**
   * Execute a command in a container (non-interactive)
   */
  async exec(
    containerId: string,
    command: string[],
    options?: {
      workingDir?: string;
      environment?: Record<string, string>;
      user?: string;
    }
  ): Promise<{ stdout: string; stderr: string }> {
    const container = this.docker.getContainer(containerId);

    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: command,
      User: options?.user || "developer",
      WorkingDir: options?.workingDir,
      Env: options?.environment
        ? Object.entries(options.environment).map(([k, v]) => `${k}=${v}`)
        : undefined,
    });

    return new Promise((resolve, reject) => {
      exec.start({ Detach: false }, (err, stream) => {
        if (err) return reject(err);

        let stdout = "";
        let stderr = "";

        // Docker multiplexes stdout/stderr when Tty is false
        container.modem.demuxStream(
          stream!,
          {
            write: (chunk: any) => {
              stdout += chunk;
            },
          } as Writable,
          {
            write: (chunk: any) => {
              stderr += chunk;
            },
          } as Writable
        );

        stream!.on("end", () => {
          resolve({ stdout, stderr });
        });
      });
    });
  }

  /**
   * Create a new container
   */
  private async createContainer(config: ContainerConfig): Promise<string> {
    this.fastify.log.info(
      `[ContainerManager] Creating container with config:`,
      {
        image: config.image,
        name: config.name,
        network: this.networkName,
        memory: config.memory,
        cpu: config.cpu,
      }
    );

    const container = await this.docker.createContainer({
      name: config.name,
      Image: config.image,
      Env: [
        ...Object.entries(config.environment || {}).map(
          ([k, v]) => `${k}=${v}`
        ),
        `USER_ID=${config.userId}`,
      ],
      HostConfig: {
        NetworkMode: this.networkName,
        Binds: config.volumes,
        // Memory: config.memory ? parseInt(config.memory) * 1024 * 1024 * 1024 : undefined,
        // CpuShares: config.cpu ? parseInt(config.cpu) * 1024 : undefined,
        // ref: https://bugzilla.redhat.com/show_bug.cgi?id=1923728
        CapAdd: ["AUDIT_WRITE", "SYS_CHROOT"],
      },
    });

    this.fastify.log.info(
      `[ContainerManager] Created container ${container.id} for user ${config.userId}`
    );

    return container.id;
  }

  /**
   * Get container info
   */
  private async getContainer(nameOrId: string): Promise<ContainerInfo | null> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: [nameOrId],
        },
      });

      if (containers.length === 0) {
        return null;
      }

      const container = containers[0]!;
      return {
        id: container.Id,
        name: container.Names[0]!.replace(/^\//, ""),
        status: container.State.toLowerCase(),
        created: new Date(container.Created * 1000),
        image: container.Image,
      };
    } catch (error: any) {
      this.fastify.log.error(
        `[ContainerManager] Error getting container ${nameOrId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Restart a user's container
   */
  async restartUserContainer(userId: string): Promise<void> {
    const containerName = `claude-web-user-${userId}`;

    try {
      const containerInfo = await this.getContainer(containerName);
      if (!containerInfo) {
        throw new Error(`Container not found for user ${userId}`);
      }

      const container = this.docker.getContainer(containerInfo.id);

      // Restart the container with a 30 second timeout
      await container.restart({ t: 30 });

      this.fastify.log.info(`Restarted container for user ${userId}`);

      // Wait a bit for container to be fully ready
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      this.fastify.log.error(
        `Failed to restart container for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Stop and remove a user's container
   */
  async removeUserContainer(userId: string): Promise<void> {
    const containerName = `claude-web-user-${userId}`;

    try {
      const containerInfo = await this.getContainer(containerName);
      if (containerInfo) {
        const container = this.docker.getContainer(containerInfo.id);

        // Stop the container
        await container.stop();

        // Remove the container
        await container.remove();

        this.fastify.log.info(`Removed container for user ${userId}`);
      }
    } catch (error: any) {
      this.fastify.log.error(
        `Failed to remove container for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Start periodic cleanup of inactive containers
   */
  private startPeriodicCleanup(): void {
    const intervalHours = parseInt(
      process.env.CONTAINER_CLEANUP_INTERVAL_HOURS || "1"
    );
    const cleanupHours = parseInt(process.env.CONTAINER_CLEANUP_HOURS || "24");

    this.fastify.log.info(
      `Container cleanup configured: check every ${intervalHours} hours, remove after ${cleanupHours} hours of inactivity`
    );

    // Run cleanup periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveContainers(cleanupHours).catch((err) => {
        this.fastify.log.error("Container cleanup failed:", err);
      });
    }, intervalHours * 60 * 60 * 1000);

    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.cleanupInactiveContainers(cleanupHours).catch((err) => {
        this.fastify.log.error("Initial container cleanup failed:", err);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Clean up inactive containers based on last activity
   */
  async cleanupInactiveContainers(inactiveHours: number = 24): Promise<void> {
    this.fastify.log.info(
      `Starting container cleanup (inactive threshold: ${inactiveHours} hours)`
    );

    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: ["claude-web-user-"],
        },
      });

      for (const containerInfo of containers) {
        const name = containerInfo.Names[0]!.replace(/^\//, "");
        const userIdMatch = name.match(/claude-web-user-(.+)/);
        if (!userIdMatch) continue;

        const userId = userIdMatch[1]!;
        let shouldRemove = false;
        let reason = "";

        // Check container state
        if (containerInfo.State === "exited") {
          // Container is stopped, check how long ago
          const created = new Date(containerInfo.Created * 1000);
          const hoursAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60);

          if (hoursAgo > 1) {
            shouldRemove = true;
            reason = `exited ${Math.round(hoursAgo)} hours ago`;
          }
        } else if (containerInfo.State === "running") {
          // For running containers, we can't determine activity without session persistence
          // For now, keep running containers unless manually stopped
          // This prevents accidental cleanup of active containers
          this.fastify.log.info(
            `Container ${name} is running - keeping it active`
          );
        }

        if (shouldRemove) {
          try {
            const container = this.docker.getContainer(containerInfo.Id);

            // Stop if running
            if (containerInfo.State === "running") {
              await container.stop();
            }

            // Remove container
            await container.remove();

            this.fastify.log.info(
              `Removed inactive container: ${name} (${reason})`
            );

            // Disable SSH route
            try {
              await this.sshConfigManager.disableUserRoute(userId);
              this.fastify.log.info(`SSH route disabled for user ${userId}`);
            } catch (error) {
              this.fastify.log.warn(
                `Failed to disable SSH route for user ${userId}: ${error}`
              );
            }

            // Sessions are ephemeral - no database updates needed
          } catch (err) {
            this.fastify.log.error(`Failed to remove container ${name}:`, err);
          }
        }
      }
    } catch (error: any) {
      this.fastify.log.error("Failed to cleanup inactive containers:", error);
    }
  }

  /**
   * Get SSH connection information for a user
   */
  getSSHConnectionInfo(userId: string) {
    return this.sshConfigManager.getSSHConnectionInfo(userId);
  }

  /**
   * Get SSH config manager instance
   */
  getSSHConfigManager() {
    return this.sshConfigManager;
  }
}
