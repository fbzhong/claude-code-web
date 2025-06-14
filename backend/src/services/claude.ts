import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export interface ClaudeProcessConfig {
  workingDir?: string;
  environment?: Record<string, string>;
  args?: string[];
  autoRestart?: boolean;
}

export interface ClaudeProcess {
  id: string;
  userId: string;
  sessionId: string;
  process: ChildProcess;
  config: ClaudeProcessConfig;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startTime: Date;
  lastActivity: Date;
  output: string[];
}

export class ClaudeService extends EventEmitter {
  private processes = new Map<string, ClaudeProcess>();
  private maxOutputLines = 1000;

  constructor(private fastify: any) {
    super();
  }

  async startClaude(
    userId: string, 
    sessionId: string, 
    config: ClaudeProcessConfig = {}
  ): Promise<ClaudeProcess> {
    const processId = `${sessionId}_claude`;
    
    // Check if Claude is already running for this session
    if (this.processes.has(processId)) {
      const existing = this.processes.get(processId)!;
      if (existing.status === 'running' || existing.status === 'starting') {
        throw new Error('Claude is already running for this session');
      }
    }

    // Find Claude Code executable
    const claudePath = await this.findClaudeExecutable();
    if (!claudePath) {
      throw new Error('Claude Code executable not found. Please ensure Claude Code is installed and in PATH.');
    }

    const workingDir = config.workingDir || process.env.HOME || '/tmp';
    const args = config.args || [];
    const env = {
      ...process.env,
      ...config.environment,
      // Ensure Claude runs in interactive mode
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    };

    this.fastify.log.info(`Starting Claude Code process`, {
      processId,
      claudePath,
      workingDir,
      args
    });

    // Spawn Claude Code process
    const childProcess = spawn(claudePath, args, {
      cwd: workingDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const claudeProcess: ClaudeProcess = {
      id: processId,
      userId,
      sessionId,
      process: childProcess,
      config,
      status: 'starting',
      startTime: new Date(),
      lastActivity: new Date(),
      output: []
    };

    this.processes.set(processId, claudeProcess);

    // Handle process events
    childProcess.on('spawn', () => {
      claudeProcess.status = 'running';
      this.fastify.log.info(`Claude Code process started: ${processId}`);
      this.emit('status_change', processId, 'running');
    });

    childProcess.on('error', (error) => {
      claudeProcess.status = 'error';
      this.fastify.log.error(`Claude Code process error: ${processId}`, error);
      this.emit('status_change', processId, 'error');
      this.emit('error', processId, error);
    });

    childProcess.on('exit', (code, signal) => {
      claudeProcess.status = 'stopped';
      this.fastify.log.info(`Claude Code process exited: ${processId}`, { code, signal });
      this.emit('status_change', processId, 'stopped');
      this.emit('exit', processId, code, signal);

      // Auto-restart if configured
      if (config.autoRestart && code !== 0) {
        setTimeout(() => {
          this.restartClaude(processId).catch(err => {
            this.fastify.log.error(`Failed to auto-restart Claude: ${processId}`, err);
          });
        }, 2000);
      }
    });

    // Handle stdout
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      this.addOutput(processId, output);
      this.emit('output', processId, output);
      claudeProcess.lastActivity = new Date();
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      this.addOutput(processId, `[ERROR] ${output}`);
      this.emit('output', processId, output);
      claudeProcess.lastActivity = new Date();
    });

    return claudeProcess;
  }

  async stopClaude(sessionId: string): Promise<boolean> {
    const processId = `${sessionId}_claude`;
    const claudeProcess = this.processes.get(processId);
    
    if (!claudeProcess) {
      return false;
    }

    this.fastify.log.info(`Stopping Claude Code process: ${processId}`);
    
    try {
      // Gracefully terminate
      claudeProcess.process.kill('SIGTERM');
      
      // Wait for process to exit, force kill if it doesn't
      setTimeout(() => {
        if (claudeProcess.status !== 'stopped') {
          claudeProcess.process.kill('SIGKILL');
        }
      }, 5000);

      return true;
    } catch (error) {
      this.fastify.log.error(`Failed to stop Claude process: ${processId}`, error);
      return false;
    }
  }

  async restartClaude(sessionId: string): Promise<ClaudeProcess> {
    const processId = `${sessionId}_claude`;
    const existing = this.processes.get(processId);
    
    if (!existing) {
      throw new Error('No Claude process found for this session');
    }

    // Stop existing process
    await this.stopClaude(sessionId);
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start new process with same config
    return this.startClaude(existing.userId, existing.sessionId, existing.config);
  }

  getClaudeProcess(sessionId: string): ClaudeProcess | undefined {
    const processId = `${sessionId}_claude`;
    return this.processes.get(processId);
  }

  getUserProcesses(userId: string): ClaudeProcess[] {
    return Array.from(this.processes.values()).filter(p => p.userId === userId);
  }

  getAllProcesses(): ClaudeProcess[] {
    return Array.from(this.processes.values());
  }

  sendInput(sessionId: string, input: string): boolean {
    const processId = `${sessionId}_claude`;
    const claudeProcess = this.processes.get(processId);
    
    if (!claudeProcess || claudeProcess.status !== 'running') {
      return false;
    }

    try {
      claudeProcess.process.stdin?.write(input);
      claudeProcess.lastActivity = new Date();
      return true;
    } catch (error) {
      this.fastify.log.error(`Failed to send input to Claude process: ${processId}`, error);
      return false;
    }
  }

  getOutput(sessionId: string, lines?: number): string[] {
    const processId = `${sessionId}_claude`;
    const claudeProcess = this.processes.get(processId);
    
    if (!claudeProcess) {
      return [];
    }

    const outputLines = claudeProcess.output;
    if (lines && lines > 0) {
      return outputLines.slice(-lines);
    }
    
    return outputLines;
  }

  private addOutput(processId: string, output: string): void {
    const claudeProcess = this.processes.get(processId);
    if (!claudeProcess) return;

    // Split output by lines and add to buffer
    const lines = output.split('\n');
    claudeProcess.output.push(...lines);
    
    // Keep only the last N lines to prevent memory issues
    if (claudeProcess.output.length > this.maxOutputLines) {
      claudeProcess.output = claudeProcess.output.slice(-this.maxOutputLines);
    }
  }

  private async findClaudeExecutable(): Promise<string | null> {
    // Common paths where Claude Code might be installed
    const possiblePaths = [
      'claude',
      'claude-code',
      '/usr/local/bin/claude',
      '/usr/local/bin/claude-code',
      '/opt/homebrew/bin/claude',
      '/opt/homebrew/bin/claude-code',
      path.join(process.env.HOME || '', '.local/bin/claude'),
      path.join(process.env.HOME || '', '.local/bin/claude-code')
    ];

    // Check if any of these paths exist and are executable
    for (const claudePath of possiblePaths) {
      try {
        // Try to find in PATH first
        if (!claudePath.includes('/')) {
          const { spawn } = require('child_process');
          const result = await new Promise<boolean>((resolve) => {
            const child = spawn('which', [claudePath], { stdio: 'pipe' });
            child.on('exit', (code: number) => resolve(code === 0));
            child.on('error', () => resolve(false));
          });
          
          if (result) {
            return claudePath;
          }
        } else {
          // Check if file exists and is executable
          if (fs.existsSync(claudePath)) {
            const stats = fs.statSync(claudePath);
            if (stats.isFile() && (stats.mode & 0o111)) {
              return claudePath;
            }
          }
        }
      } catch (error) {
        // Continue checking other paths
      }
    }

    return null;
  }

  // Cleanup method to kill all processes on shutdown
  async cleanup(): Promise<void> {
    this.fastify.log.info('Cleaning up Claude processes...');
    
    const promises = Array.from(this.processes.keys()).map(async (sessionId) => {
      const sessionIdOnly = sessionId.replace('_claude', '');
      await this.stopClaude(sessionIdOnly);
    });

    await Promise.all(promises);
    this.processes.clear();
  }
}