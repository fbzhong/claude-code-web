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
  private defaultImage: string;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(private fastify: any) {
    super();
    
    // Detect container runtime
    this.runtime = process.env.CONTAINER_RUNTIME as 'docker' | 'podman' || 'docker';
    
    // Use custom image if specified, otherwise use default Ubuntu
    this.defaultImage = process.env.CONTAINER_IMAGE || 'ubuntu:22.04';
    
    this.fastify.log.info(`Using container runtime: ${this.runtime}`);
    this.fastify.log.info(`Using container image: ${this.defaultImage}`);
    
    // Start periodic cleanup of inactive containers
    this.startPeriodicCleanup();
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
      this.fastify.log.info(`[ContainerManager] Creating container with image: ${this.defaultImage}`);
      
      const containerConfig = {
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
          `claude-web-user-${userId}-data:/home/developer`,
        ],
      };
      
      this.fastify.log.info(`[ContainerManager] Container config:`, containerConfig);
      
      const containerId = await this.createContainer(containerConfig);
      
      // Start the container
      this.fastify.log.info(`[ContainerManager] Starting container ${containerId}`);
      await this.startContainer(containerId);
      
      // Initialize the container only if using base Ubuntu image
      if (this.defaultImage === 'ubuntu:22.04') {
        this.fastify.log.info(`[ContainerManager] Initializing container ${containerId} (base image)`);
        await this.initializeContainer(containerId, userId);
      } else {
        this.fastify.log.info(`[ContainerManager] Skipping initialization for custom image: ${this.defaultImage}`);
      }
      
      this.fastify.log.info(`[ContainerManager] Successfully created and initialized container ${containerId}`);
      return containerId;
    } catch (error: any) {
      this.fastify.log.error(`[ContainerManager] Failed to get/create container for user ${userId}:`, {
        error: error.message,
        stack: error.stack,
        code: error.code,
        stderr: error.stderr,
        stdout: error.stdout,
        containerName: containerName
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
    // Use -i only to keep stdin open
    const args = ['exec', '-i'];
    
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
    
    // Resource limits - comment out for debugging
    // if (config.memory) {
    //   args.push('--memory', config.memory);
    // }
    
    // if (config.cpu) {
    //   args.push('--cpus', config.cpu);
    // }
    
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
    
    // Keep container running with sleep infinity (simpler and more reliable)
    args.push(config.image);
    args.push('sleep', 'infinity');
    
    const command = `${this.runtime} ${args.join(' ')}`;
    this.fastify.log.info(`[ContainerManager] Executing: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command);
      const containerId = stdout.trim();
      
      if (!containerId) {
        throw new Error('Container creation returned empty ID');
      }
      
      if (stderr) {
        this.fastify.log.warn(`[ContainerManager] Container creation stderr:`, stderr);
      }
      
      this.fastify.log.info(`[ContainerManager] Created container ${containerId} for user ${config.userId}`);
      return containerId;
    } catch (error: any) {
      this.fastify.log.error(`[ContainerManager] Failed to create container:`, {
        command,
        error: error.message,
        stderr: error.stderr,
        stdout: error.stdout
      });
      throw new Error(`Failed to create container: ${error.message}`);
    }
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
      // Check for container not found errors
      const errorMessage = error.stderr || error.message || '';
      if (error.code === 125 || 
          errorMessage.includes('No such object') ||
          errorMessage.includes('no such container') ||
          errorMessage.includes('No such container')) {
        this.fastify.log.info(`[ContainerManager] Container ${nameOrId} not found, will create new one`);
        return null;
      }
      this.fastify.log.error(`[ContainerManager] Error inspecting container ${nameOrId}:`, {
        error: error.message,
        code: error.code,
        stderr: error.stderr,
        stdout: error.stdout,
        fullError: error.toString()
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
   * Start periodic cleanup of inactive containers
   */
  private startPeriodicCleanup(): void {
    const intervalHours = parseInt(process.env.CONTAINER_CLEANUP_INTERVAL_HOURS || '1');
    const cleanupHours = parseInt(process.env.CONTAINER_CLEANUP_HOURS || '24');
    
    this.fastify.log.info(`Container cleanup configured: check every ${intervalHours} hours, remove after ${cleanupHours} hours of inactivity`);
    
    // Run cleanup periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveContainers(cleanupHours).catch(err => {
        this.fastify.log.error('Container cleanup failed:', err);
      });
    }, intervalHours * 60 * 60 * 1000);
    
    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.cleanupInactiveContainers(cleanupHours).catch(err => {
        this.fastify.log.error('Initial container cleanup failed:', err);
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
    this.fastify.log.info(`Starting container cleanup (inactive threshold: ${inactiveHours} hours)`);
    try {
      const { stdout } = await execAsync(
        `${this.runtime} ps -a --filter "name=claude-web-user-" --format "{{.ID}} {{.Names}} {{.Status}}"`
      );
      
      const lines = stdout.trim().split('\n').filter(Boolean);
      const now = new Date();
      
      for (const line of lines) {
        const [id, name, ...statusParts] = line.split(' ');
        const status = statusParts.join(' ');
        
        // Extract user ID from container name
        const userIdMatch = name.match(/claude-web-user-(.+)/);
        if (!userIdMatch) continue;
        
        const userId = userIdMatch[1];
        
        // Check container age and activity
        let shouldRemove = false;
        let reason = '';
        
        // Check if container is stopped
        if (status.includes('Exited')) {
          const match = status.match(/Exited.*\((\d+)\s+(days?|hours?|minutes?)\s+ago\)/);
          if (match) {
            const [, amount, unit] = match;
            const value = parseInt(amount);
            
            // Remove if exited more than 1 hour ago
            if (unit.startsWith('hour') && value >= 1) {
              shouldRemove = true;
              reason = `exited ${value} hours ago`;
            } else if (unit.startsWith('day')) {
              shouldRemove = true;
              reason = `exited ${value} days ago`;
            }
          }
        } else if (status.includes('Up')) {
          // For running containers, check last session activity
          try {
            // Query database for last activity of sessions belonging to this user
            const client = await this.fastify.pg.connect();
            const result = await client.query(
              'SELECT MAX(last_activity) as last_activity FROM persistent_sessions WHERE user_id = $1',
              [userId]
            );
            client.release();
            
            if (result.rows[0]?.last_activity) {
              const lastActivity = new Date(result.rows[0].last_activity);
              const hoursInactive = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
              
              if (hoursInactive > inactiveHours) {
                shouldRemove = true;
                reason = `inactive for ${Math.round(hoursInactive)} hours`;
              }
            } else {
              // No sessions found, check container uptime
              const uptimeMatch = status.match(/Up\s+(\d+)\s+(days?|hours?|minutes?)/);
              if (uptimeMatch) {
                const [, amount, unit] = uptimeMatch;
                const value = parseInt(amount);
                
                if (unit.startsWith('day') || (unit.startsWith('hour') && value >= inactiveHours)) {
                  shouldRemove = true;
                  reason = `no sessions and up for ${value} ${unit}`;
                }
              }
            }
          } catch (err) {
            this.fastify.log.error(`Failed to check activity for user ${userId}:`, err);
          }
        }
        
        if (shouldRemove) {
          try {
            // Stop and remove container
            if (!status.includes('Exited')) {
              await execAsync(`${this.runtime} stop ${id}`);
            }
            await execAsync(`${this.runtime} rm ${id}`);
            this.fastify.log.info(`Removed inactive container: ${name} (${reason})`);
            
            // Update dead sessions in database
            try {
              const client = await this.fastify.pg.connect();
              await client.query(
                'UPDATE persistent_sessions SET status = $1 WHERE user_id = $2 AND status != $1',
                ['dead', userId]
              );
              client.release();
            } catch (err) {
              this.fastify.log.error(`Failed to update sessions for user ${userId}:`, err);
            }
          } catch (err) {
            this.fastify.log.error(`Failed to remove container ${name}:`, err);
          }
        }
      }
    } catch (error: any) {
      this.fastify.log.error('Failed to cleanup inactive containers:', error);
    }
  }
}