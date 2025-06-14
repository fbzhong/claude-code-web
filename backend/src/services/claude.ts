import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { ClaudeCodeProcess, ClaudeCodeConfig } from '../types';

export class ClaudeService extends EventEmitter {
  private processes = new Map<string, ClaudeCodeProcess>();
  private childProcesses = new Map<string, ChildProcess>();

  constructor(private fastify: any) {
    super();
  }

  async startClaude(sessionId: string, config: ClaudeCodeConfig): Promise<ClaudeCodeProcess> {
    const processId = crypto.randomUUID();
    
    try {
      // Check if Claude Code is available
      const claudePath = await this.findClaudeExecutable();
      
      const claudeProcess = spawn(claudePath, config.args || [], {
        cwd: config.workingDir || process.cwd(),
        env: {
          ...process.env,
          ...config.environment,
          CLAUDE_WEB_SESSION: sessionId
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const processInfo: ClaudeCodeProcess = {
        id: processId,
        sessionId,
        pid: claudeProcess.pid || 0,
        status: 'starting',
        startedAt: new Date(),
        config
      };

      this.processes.set(processId, processInfo);
      this.childProcesses.set(processId, claudeProcess);

      // Handle process events
      claudeProcess.on('spawn', () => {
        processInfo.status = 'running';
        this.fastify.log.info(`Claude Code started for session ${sessionId}`, { pid: claudeProcess.pid });
        this.emit('started', sessionId, processInfo);
        this.saveProcessToDb(processInfo);
      });

      claudeProcess.on('error', (error) => {
        processInfo.status = 'error';
        this.fastify.log.error(`Claude Code error for session ${sessionId}:`, error);
        this.emit('error', sessionId, error);
        this.cleanup(processId);
      });

      claudeProcess.on('exit', (code, signal) => {
        processInfo.status = 'stopped';
        this.fastify.log.info(`Claude Code exited for session ${sessionId}`, { code, signal });
        this.emit('exit', sessionId, code);
        
        if (config.autoRestart && code !== 0) {
          this.fastify.log.info(`Auto-restarting Claude Code for session ${sessionId}`);
          setTimeout(() => this.startClaude(sessionId, config), 5000);
        }
        
        this.cleanup(processId);
      });

      // Handle stdout/stderr
      claudeProcess.stdout?.on('data', (data) => {
        this.emit('stdout', sessionId, data.toString());
      });

      claudeProcess.stderr?.on('data', (data) => {
        this.emit('stderr', sessionId, data.toString());
      });

      return processInfo;
      
    } catch (error) {
      this.fastify.log.error(`Failed to start Claude Code for session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopClaude(sessionId: string): Promise<boolean> {
    const process = this.getProcessBySession(sessionId);
    if (!process) {
      return false;
    }

    const childProcess = this.childProcesses.get(process.id);
    if (childProcess) {
      childProcess.kill('SIGTERM');
      
      // Force kill after 10 seconds
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
      }, 10000);
      
      return true;
    }

    return false;
  }

  async restartClaude(sessionId: string): Promise<ClaudeCodeProcess | null> {
    const process = this.getProcessBySession(sessionId);
    if (!process) {
      return null;
    }

    await this.stopClaude(sessionId);
    
    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return this.startClaude(sessionId, process.config);
  }

  sendInput(sessionId: string, input: string): boolean {
    const process = this.getProcessBySession(sessionId);
    if (!process) {
      return false;
    }

    const childProcess = this.childProcesses.get(process.id);
    if (childProcess && childProcess.stdin) {
      childProcess.stdin.write(input);
      return true;
    }

    return false;
  }

  getProcessBySession(sessionId: string): ClaudeCodeProcess | undefined {
    return Array.from(this.processes.values()).find(p => p.sessionId === sessionId);
  }

  getAllProcesses(): ClaudeCodeProcess[] {
    return Array.from(this.processes.values());
  }

  getProcessStatus(sessionId: string): string {
    const process = this.getProcessBySession(sessionId);
    return process?.status || 'stopped';
  }

  private async findClaudeExecutable(): Promise<string> {
    // Try to find Claude Code executable
    const possiblePaths = [
      'claude',
      '/usr/local/bin/claude',
      '/opt/claude/bin/claude',
      process.env.CLAUDE_PATH || ''
    ].filter(Boolean);

    for (const path of possiblePaths) {
      try {
        const result = spawn(path, ['--version'], { stdio: 'pipe' });
        await new Promise((resolve, reject) => {
          result.on('close', (code) => {
            if (code === 0) resolve(code);
            else reject(new Error(`Exit code ${code}`));
          });
          result.on('error', reject);
        });
        return path;
      } catch {
        continue;
      }
    }

    throw new Error('Claude Code executable not found. Please install Claude Code or set CLAUDE_PATH environment variable.');
  }

  private cleanup(processId: string): void {
    this.processes.delete(processId);
    this.childProcesses.delete(processId);
  }

  private async saveProcessToDb(process: ClaudeCodeProcess): Promise<void> {
    try {
      const client = await this.fastify.pg.connect();
      await client.query(
        'INSERT INTO claude_processes (id, session_id, pid, status, started_at, config) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET status = $4, started_at = $5',
        [process.id, process.sessionId, process.pid, process.status, process.startedAt, JSON.stringify(process.config)]
      );
      client.release();
    } catch (err) {
      this.fastify.log.error('Failed to save process to database:', err);
    }
  }

  // Cleanup all processes on shutdown
  async cleanup(): Promise<void> {
    const promises = Array.from(this.childProcesses.values()).map(childProcess => {
      return new Promise<void>((resolve) => {
        if (childProcess.killed) {
          resolve();
          return;
        }

        childProcess.on('exit', () => resolve());
        childProcess.kill('SIGTERM');
        
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    });

    await Promise.all(promises);
    this.processes.clear();
    this.childProcesses.clear();
  }
}