import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

export class ContainerManager extends EventEmitter {
  private runtime: 'docker' | 'podman';
  private defaultImage = 'ubuntu:22.04'; // Or a custom image with development tools
  
  constructor(private fastify: any) {
    super();
    
    // Detect container runtime
    this.runtime = process.env.CONTAINER_RUNTIME as 'docker' | 'podman' || 'docker';
    this.fastify.log.info(`Using container runtime: ${this.runtime}`);
  }
  
  /**
   * Get or create a container for a user
   */
  async getOrCreateUserContainer(userId: string): Promise<string> {
    const containerName = `claude-web-user-${userId}`;
    
    this.fastify.log.info(`[ContainerManager] Getting or creating container for user ${userId}, name: ${containerName}`);
    
    try {
      // Check if container exists
      this.fastify.log.info(`[ContainerManager] Checking if container ${containerName} exists...`);
      const existingContainer = await this.getContainer(containerName);
      if (existingContainer) {
        this.fastify.log.info(`[ContainerManager] Found existing container ${existingContainer.id} with status: ${existingContainer.status}`);
        // Ensure it's running
        if (existingContainer.status !== 'running') {
          this.fastify.log.info(`[ContainerManager] Starting existing container ${existingContainer.id}`);
          await this.startContainer(existingContainer.id);
        }
        this.fastify.log.info(`[ContainerManager] Using existing container ${existingContainer.id}`);
        return existingContainer.id;
      }
      
      // Create new container
      this.fastify.log.info(`[ContainerManager] No existing container found, creating new one...`);
      const containerId = await this.createContainer({
        image: this.defaultImage,
        name: containerName,
        userId,
        memory: process.env.CONTAINER_MEMORY_LIMIT || '2g',
        cpu: process.env.CONTAINER_CPU_LIMIT || '1',
        environment: {
          USER: 'developer',
          HOME: '/home/developer',
          TERM: 'xterm-256color',
          LANG: 'en_US.UTF-8',
        },
        volumes: [
          // Mount a persistent volume for user data
          `claude-web-user-${userId}-data:/home/developer`,
        ],
      });
      
      // Start the container
      this.fastify.log.info(`[ContainerManager] Starting container ${containerId}`);
      await this.startContainer(containerId);
      
      // Initialize the container (create user, install basic tools, etc.)
      this.fastify.log.info(`[ContainerManager] Initializing container ${containerId}`);
      await this.initializeContainer(containerId, userId);
      
      this.fastify.log.info(`[ContainerManager] Successfully created and initialized container ${containerId}`);
      return containerId;
    } catch (error: any) {
      this.fastify.log.error(`[ContainerManager] Failed to get/create container for user ${userId}:`, {
        error: error.message,
        stack: error.stack,
        code: error.code,
        stderr: error.stderr
      });
      throw error;
    }
  }
  
  /**
   * Execute a command in a container
   */
  async exec(containerId: string, command: string[], options?: {
    workingDir?: string;
    environment?: Record<string, string>;
    user?: string;
  }): Promise<{ stdout: string; stderr: string }> {
    const args = ['exec'];
    
    if (options?.workingDir) {
      args.push('-w', options.workingDir);
    }
    
    if (options?.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        args.push('-e', `${key}=${value}`);
      }
    }
    
    if (options?.user) {
      args.push('-u', options.user);
    }
    
    args.push(containerId, ...command);
    
    const { stdout, stderr } = await execAsync(`${this.runtime} ${args.join(' ')}`);
    return { stdout, stderr };
  }
  
  /**
   * Execute an interactive command in a container (returns a child process)
   */
  execInteractive(containerId: string, command: string[], options?: {
    workingDir?: string;
    environment?: Record<string, string>;
    user?: string;
  }) {
    const args = ['exec', '-it'];
    
    if (options?.workingDir) {
      args.push('-w', options.workingDir);
    }
    
    if (options?.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        args.push('-e', `${key}=${value}`);
      }
    }
    
    if (options?.user) {
      args.push('-u', options.user);
    }
    
    args.push(containerId, ...command);
    
    return spawn(this.runtime, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
  
  /**
   * Create a new container
   */
  private async createContainer(config: ContainerConfig): Promise<string> {
    this.fastify.log.info(`[ContainerManager] Creating container with config:`, {
      image: config.image,
      name: config.name,
      memory: config.memory,
      cpu: config.cpu
    });
    
    const args = ['create'];
    
    // Container name
    args.push('--name', config.name);
    
    // Resource limits
    if (config.memory) {
      args.push('--memory', config.memory);
    }
    
    if (config.cpu) {
      args.push('--cpus', config.cpu);
    }
    
    // Environment variables
    if (config.environment) {
      for (const [key, value] of Object.entries(config.environment)) {
        args.push('-e', `${key}=${value}`);
      }
    }
    
    // Volumes
    if (config.volumes) {
      for (const volume of config.volumes) {
        args.push('-v', volume);
      }
    }
    
    // Interactive and TTY
    args.push('-it');
    
    // Keep container running
    args.push('--entrypoint', '/bin/sh');
    args.push(config.image);
    args.push('-c', 'while true; do sleep 1000; done');
    
    const command = `${this.runtime} ${args.join(' ')}`;
    this.fastify.log.info(`[ContainerManager] Executing: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    const containerId = stdout.trim();
    
    if (stderr) {
      this.fastify.log.warn(`[ContainerManager] Container creation stderr:`, stderr);
    }
    
    this.fastify.log.info(`[ContainerManager] Created container ${containerId} for user ${config.userId}`);
    return containerId;
  }
  
  /**
   * Start a container
   */
  private async startContainer(containerId: string): Promise<void> {
    const command = `${this.runtime} start ${containerId}`;
    this.fastify.log.info(`[ContainerManager] Executing: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      this.fastify.log.warn(`[ContainerManager] Container start stderr:`, stderr);
    }
    
    this.fastify.log.info(`[ContainerManager] Started container ${containerId}, stdout: ${stdout.trim()}`);
  }
  
  /**
   * Get container info
   */
  private async getContainer(nameOrId: string): Promise<ContainerInfo | null> {
    try {
      const command = `${this.runtime} inspect ${nameOrId} --format '{{json .}}'`;
      this.fastify.log.debug(`[ContainerManager] Executing: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        this.fastify.log.debug(`[ContainerManager] Container inspect stderr:`, stderr);
      }
      
      const data = JSON.parse(stdout);
      
      return {
        id: data.Id || data.ID,
        name: data.Name.replace(/^\//, ''),
        status: data.State.Status || data.State.Running ? 'running' : 'stopped',
        created: new Date(data.Created),
        image: data.Config.Image,
      };
    } catch (error: any) {
      if (error.code === 125 || error.stderr?.includes('no such container')) {
        this.fastify.log.debug(`[ContainerManager] Container ${nameOrId} not found`);
        return null;
      }
      this.fastify.log.error(`[ContainerManager] Error inspecting container ${nameOrId}:`, {
        error: error.message,
        code: error.code,
        stderr: error.stderr
      });
      throw error;
    }
  }
  
  /**
   * Initialize a new container with basic setup
   */
  private async initializeContainer(containerId: string, userId: string): Promise<void> {
    // Create user and set up home directory
    const setupCommands = [
      // Create user if not exists
      'id developer || useradd -m -s /bin/bash developer',
      // Set up basic directory structure
      'mkdir -p /home/developer/{.ssh,.config,workspace}',
      // Set permissions
      'chown -R developer:developer /home/developer',
      // Install basic development tools (customize based on your needs)
      'apt-get update && apt-get install -y git vim nano curl wget build-essential python3 nodejs npm',
    ];
    
    for (const cmd of setupCommands) {
      try {
        await this.exec(containerId, ['sh', '-c', cmd], { user: 'root' });
      } catch (error: any) {
        this.fastify.log.warn(`Setup command failed: ${cmd}`, error.message);
      }
    }
    
    this.fastify.log.info(`Initialized container ${containerId} for user ${userId}`);
  }
  
  /**
   * Stop and remove a user's container
   */
  async removeUserContainer(userId: string): Promise<void> {
    const containerName = `claude-web-user-${userId}`;
    
    try {
      const container = await this.getContainer(containerName);
      if (container) {
        // Stop the container
        await execAsync(`${this.runtime} stop ${container.id}`);
        
        // Remove the container
        await execAsync(`${this.runtime} rm ${container.id}`);
        
        this.fastify.log.info(`Removed container for user ${userId}`);
      }
    } catch (error: any) {
      this.fastify.log.error(`Failed to remove container for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Clean up inactive containers
   */
  async cleanupInactiveContainers(inactiveDays: number = 7): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `${this.runtime} ps -a --filter "name=claude-web-user-" --format "{{.ID}} {{.Names}} {{.Status}}"`
      );
      
      const lines = stdout.trim().split('\n').filter(Boolean);
      const now = new Date();
      
      for (const line of lines) {
        const [id, name, ...statusParts] = line.split(' ');
        const status = statusParts.join(' ');
        
        // Check if container has been stopped for too long
        if (status.includes('Exited')) {
          const match = status.match(/Exited.*\((\d+)\s+(days?|hours?|minutes?)\s+ago\)/);
          if (match) {
            const [, amount, unit] = match;
            const value = parseInt(amount);
            
            let shouldRemove = false;
            if (unit.startsWith('day') && value >= inactiveDays) {
              shouldRemove = true;
            }
            
            if (shouldRemove) {
              await execAsync(`${this.runtime} rm ${id}`);
              this.fastify.log.info(`Removed inactive container: ${name}`);
            }
          }
        }
      }
    } catch (error: any) {
      this.fastify.log.error('Failed to cleanup inactive containers:', error);
    }
  }
}