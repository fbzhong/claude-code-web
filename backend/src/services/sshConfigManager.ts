import { FastifyInstance } from 'fastify';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SSHConfigManager {
  private workingDirRoot: string;
  private sshpiperPrivateKey: string;
  private fastify: FastifyInstance;
  
  /**
   * Generate short username from UUID (first 8 chars)
   */
  private getShortUsername(userId: string): string {
    return `u${userId.replace(/-/g, '').substring(0, 8)}`;
  }
  
  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    // SSHpiper workingDir root (relative to project root, not backend dir)
    const projectRoot = path.dirname(process.cwd());
    this.workingDirRoot = process.env.SSHPIPER_WORKINGDIR || path.join(projectRoot, 'sshpiper', 'workingdir');
    // SSHpiper's private key for connecting to containers
    this.sshpiperPrivateKey = path.join(projectRoot, 'sshpiper', 'sshpiper_id_rsa');
  }
  
  /**
   * Ensure user's workingDir structure exists (without overwriting authorized_keys)
   */
  private async ensureUserWorkingDir(userId: string): Promise<string> {
    const shortUsername = this.getShortUsername(userId);
    const userDir = path.join(this.workingDirRoot, shortUsername);
    
    try {
      // Create user directory
      await fs.mkdir(userDir, { recursive: true });
      
      // Create sshpiper_upstream file if it doesn't exist
      const upstreamPath = path.join(userDir, 'sshpiper_upstream');
      try {
        await fs.access(upstreamPath);
      } catch {
        const containerName = `claude-web-user-${userId}`;
        const upstreamContent = `developer@${containerName}:22\n`;
        await fs.writeFile(upstreamPath, upstreamContent, { mode: 0o600 });
      }
      
      // Copy SSHpiper's private key if it doesn't exist
      const idRsaPath = path.join(userDir, 'id_rsa');
      try {
        await fs.access(idRsaPath);
      } catch {
        await fs.copyFile(this.sshpiperPrivateKey, idRsaPath);
        await fs.chmod(idRsaPath, 0o600);
      }
      
      // Ensure authorized_keys file exists (but don't overwrite)
      const authorizedKeysPath = path.join(userDir, 'authorized_keys');
      try {
        await fs.access(authorizedKeysPath);
      } catch {
        await fs.writeFile(authorizedKeysPath, '', { mode: 0o600 });
      }
      
      this.fastify.log.info(`[SSHConfigManager] Ensured workingDir structure for ${shortUsername} (${userId})`);
      return userDir;
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to ensure workingDir: ${error}`);
      throw error;
    }
  }

  /**
   * Create user's workingDir structure (for initial setup)
   */
  private async createUserWorkingDir(userId: string): Promise<string> {
    const shortUsername = this.getShortUsername(userId);
    const userDir = path.join(this.workingDirRoot, shortUsername);
    
    try {
      // Create user directory
      await fs.mkdir(userDir, { recursive: true });
      
      // Create sshpiper_upstream file with container connection info
      const upstreamPath = path.join(userDir, 'sshpiper_upstream');
      const containerName = `claude-web-user-${userId}`;
      
      // Format: username@host:port
      const upstreamContent = `developer@${containerName}:22\n`;
      await fs.writeFile(upstreamPath, upstreamContent, { mode: 0o600 });
      
      // Copy SSHpiper's private key as id_rsa for authentication
      await fs.copyFile(this.sshpiperPrivateKey, path.join(userDir, 'id_rsa'));
      await fs.chmod(path.join(userDir, 'id_rsa'), 0o600);
      
      // Create authorized_keys file (will be populated when user uploads keys)
      const authorizedKeysPath = path.join(userDir, 'authorized_keys');
      await fs.writeFile(authorizedKeysPath, '', { mode: 0o600 });
      
      this.fastify.log.info(`[SSHConfigManager] Created workingDir for ${shortUsername} (${userId})`);
      return userDir;
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to create workingDir: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update user's authorized_keys in workingDir
   */
  async updateUserAuthorizedKeys(userId: string, publicKeys: string[]): Promise<void> {
    const shortUsername = this.getShortUsername(userId);
    const userDir = path.join(this.workingDirRoot, shortUsername);
    
    try {
      // Ensure complete user workingDir structure exists (without overwriting)
      await this.ensureUserWorkingDir(userId);
      
      // Write all public keys
      const authorizedKeysPath = path.join(userDir, 'authorized_keys');
      const content = publicKeys.join('\n') + (publicKeys.length > 0 ? '\n' : '');
      await fs.writeFile(authorizedKeysPath, content, { mode: 0o600 });
      
      this.fastify.log.info(`[SSHConfigManager] Updated authorized_keys for ${shortUsername} (${userId}), ${publicKeys.length} keys`);
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to update authorized_keys: ${error}`);
      throw error;
    }
  }
  
  /**
   * Add user SSH route (create workingDir structure)
   */
  async addUserRoute(userId: string, containerName: string): Promise<void> {
    const shortUsername = this.getShortUsername(userId);
    this.fastify.log.info(`[SSHConfigManager] Adding user route: ${shortUsername} (${userId}) -> ${containerName}`);
    
    try {
      await this.createUserWorkingDir(userId);
      
      // No need to reload SSHpiper - workingDir is checked on each connection
      this.fastify.log.info(`[SSHConfigManager] Route added for ${shortUsername}`);
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to add route: ${error}`);
      throw error;
    }
  }
  
  /**
   * Remove user SSH route (remove workingDir)
   */
  async removeUserRoute(userId: string): Promise<void> {
    const shortUsername = this.getShortUsername(userId);
    this.fastify.log.info(`[SSHConfigManager] Removing user route: ${shortUsername} (${userId})`);
    
    const userDir = path.join(this.workingDirRoot, shortUsername);
    
    try {
      await fs.rm(userDir, { recursive: true, force: true });
      this.fastify.log.info(`[SSHConfigManager] Route removed for ${shortUsername}`);
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to remove route: ${error}`);
      // Non-fatal error
    }
  }
  
  /**
   * Check if user has SSH route configured
   */
  async hasUserRoute(userId: string): Promise<boolean> {
    const shortUsername = this.getShortUsername(userId);
    const userDir = path.join(this.workingDirRoot, shortUsername);
    
    try {
      await fs.access(userDir);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get user's SSH connection info
   */
  getSSHConnectionInfo(userId: string): {
    username: string;
    host: string;
    port: number;
    command: string;
  } {
    const host = process.env.SSH_HOST || 'localhost';
    const port = 2222;
    const username = this.getShortUsername(userId);
    
    return {
      username,
      host,
      port,
      command: `ssh ${username}@${host} -p ${port}`
    };
  }
  
  /**
   * List all active SSH routes
   */
  async listRoutes(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.workingDirRoot);
      return entries.filter(entry => entry.startsWith('u'));
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to list routes: ${error}`);
      return [];
    }
  }
  
  /**
   * Check SSHpiper service status
   */
  async checkSSHpiperStatus(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker ps --filter name=claude-web-sshpiper --format "{{.State}}"');
      return stdout.trim() === 'running';
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Failed to check SSHpiper status: ${error}`);
      return false;
    }
  }
  
  /**
   * Initialize SSHpiper working directory
   */
  async initialize(): Promise<void> {
    try {
      // Ensure workingDir root exists
      await fs.mkdir(this.workingDirRoot, { recursive: true });
      
      // Check if SSHpiper private key exists
      try {
        await fs.access(this.sshpiperPrivateKey);
      } catch {
        this.fastify.log.error('[SSHConfigManager] SSHpiper private key not found. Please generate it first.');
        throw new Error('SSHpiper private key not found');
      }
      
      this.fastify.log.info('[SSHConfigManager] Initialized successfully');
    } catch (error) {
      this.fastify.log.error(`[SSHConfigManager] Initialization failed: ${error}`);
      throw error;
    }
  }
}