import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { TerminalSession, CommandHistory } from '../types';
import { ContainerManager } from './containerManager';
import { ContainerPty } from './containerPty';

export interface SessionInfo {
  id: string;
  name: string;
  status: 'active' | 'detached' | 'dead';
  createdAt: Date;
  lastActivity: Date;
  workingDir: string;
  connectedClients: number;
  outputPreview?: string;
  lastCommand?: string;
  isExecuting?: boolean;
}

export class SessionManager extends EventEmitter {
  private static instance: SessionManager | null = null;
  private sessions = new Map<string, TerminalSession>();
  private commandBuffer = new Map<string, string>();
  private sessionSequenceNumbers = new Map<string, number>();
  private maxOutputBuffer = 10000; // Maximum lines to keep in memory
  private maxSessions = 50; // Maximum sessions per user
  private cwdCheckTimers = new Map<string, NodeJS.Timeout>(); // Timers for CWD checking
  private outputUpdateTimers = new Map<string, NodeJS.Timeout>(); // Timers for output update delays
  private containerManager?: ContainerManager;
  private useContainers: boolean;

  constructor(private fastify: any) {
    super();
    
    // Check if container mode is enabled
    this.useContainers = process.env.CONTAINER_MODE === 'true';
    
    if (this.useContainers) {
      this.containerManager = new ContainerManager(fastify);
      this.fastify.log.info('Container mode enabled');
    } else {
      this.fastify.log.info('Local shell mode enabled');
    }
    
    // Cleanup dead sessions periodically
    setInterval(() => {
      this.cleanupDeadSessions();
    }, 60000); // Every minute
    
    // Audit connection counts periodically
    setInterval(() => {
      this.auditConnectionCounts();
    }, 30000); // Every 30 seconds
    
    // Load active sessions from database on startup
    setTimeout(() => {
      this.loadActiveSessionsFromDatabase().catch(err => {
        this.fastify.log.error('Failed to load sessions from database on startup:', err);
      });
    }, 1000); // Delay to ensure database is ready
  }

  static getInstance(fastify: any): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(fastify);
    }
    return SessionManager.instance;
  }

  async createSession(
    userId: string, 
    options: {
      sessionId?: string;
      name?: string;
      workingDir?: string;
      environment?: Record<string, string>;
    } = {}
  ): Promise<TerminalSession> {
    const sessionId = options.sessionId || crypto.randomUUID();
    const sessionName = options.name || `Session ${this.getUserSessions(userId).length + 1}`;
    
    // Check session limit
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length >= this.maxSessions) {
      throw new Error(`Maximum number of sessions (${this.maxSessions}) reached`);
    }

    let ptyProcess: any;
    let workingDir: string;
    
    if (this.useContainers && this.containerManager) {
      // Container mode - each user gets their own container
      this.fastify.log.info(`Creating containerized session for user ${userId}`);
      
      try {
        // Get or create user's container
        const containerId = await this.containerManager.getOrCreateUserContainer(userId);
        
        // Use container's home directory as default
        workingDir = options.workingDir || '/home/developer';
        
        // Create PTY process in container
        ptyProcess = ContainerPty.spawn(
          this.containerManager,
          containerId,
          'bash',
          [],
          {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: workingDir,
            env: {
              ...options.environment,
              TERM: 'xterm-256color',
              COLORTERM: 'truecolor',
              USER: 'developer',
              HOME: '/home/developer'
            },
            user: 'developer'
          }
        );
        
        this.fastify.log.info(`Created container PTY for session ${sessionId} in container ${containerId}`);
      } catch (error: any) {
        this.fastify.log.error(`Failed to create containerized session:`, error);
        throw new Error(`Failed to create containerized session: ${error.message}`);
      }
    } else {
      // Local mode - use host shell
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      workingDir = options.workingDir || process.env.HOME || '/tmp';
      
      this.fastify.log.info(`Creating local session with workingDir: "${workingDir}"`);
      
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: {
          ...process.env,
          ...options.environment,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });
    }

    const session: TerminalSession = {
      id: sessionId,
      userId,
      name: sessionName,
      pty: ptyProcess,
      history: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      workingDir,
      environment: options.environment || {},
      status: 'active',
      outputBuffer: [],
      connectedClients: 0
    };

    // Handle PTY data and buffer output
    ptyProcess.onData((data: string) => {
      this.addToOutputBuffer(sessionId, data); // Note: this is now async but we don't await to avoid blocking
      this.emit('data', sessionId, data);
      this.updateActivity(sessionId);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.fastify.log.info(`Terminal session ${sessionId} exited`, { exitCode, signal });
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'dead';
        session.pty = undefined;
      }
      this.emit('exit', sessionId, exitCode);
    });

    this.sessions.set(sessionId, session);

    // Save session to database asynchronously (don't block the response)
    this.saveSessionToDb(session).catch(err => {
      this.fastify.log.error('Failed to save session to database after creation:', err);
    });

    this.fastify.log.info(`Created new terminal session: ${sessionId} (${sessionName}) for user ${userId}`);
    
    // Emit session list update event
    const sessionInfo = this.sessionToInfo(session);
    this.fastify.log.info(`Emitting session_created event for session ${sessionId}:`, sessionInfo);
    this.emit('session_created', sessionInfo);
    
    return session;
  }

  async attachToSession(sessionId: string, userId: string): Promise<TerminalSession> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to restore from database
      return this.restoreSessionFromDb(sessionId, userId);
    }

    if (session.userId !== userId) {
      throw new Error('Access denied: session belongs to another user');
    }

    if (session.status === 'dead') {
      throw new Error('Cannot attach to dead session');
    }

    // Increment connected clients
    session.connectedClients++;
    session.status = 'active';
    session.lastActivity = new Date();

    this.fastify.log.info(`User ${userId} attached to session ${sessionId} (${session.connectedClients} clients)`);

    // Emit session list update event
    const sessionInfo = this.sessionToInfo(session);
    this.fastify.log.info(`Emitting session_updated event for session ${sessionId}:`, sessionInfo);
    this.emit('session_updated', sessionInfo);

    return session;
  }

  detachFromSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return false;
    }

    session.connectedClients = Math.max(0, session.connectedClients - 1);
    
    if (session.connectedClients === 0) {
      session.status = 'detached';
    }

    this.fastify.log.info(`User ${userId} detached from session ${sessionId} (${session.connectedClients} clients remaining)`);

    // Emit session list update event
    const sessionInfo = this.sessionToInfo(session);
    this.fastify.log.info(`Emitting session_updated event for session ${sessionId}:`, sessionInfo);
    this.emit('session_updated', sessionInfo);

    return true;
  }

  async killSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return false;
    }

    if (session.pty) {
      session.pty.kill();
    }

    session.status = 'dead';
    
    // Remove from memory immediately (clients will get updated via API refresh)
    this.sessions.delete(sessionId);
    this.commandBuffer.delete(sessionId);
    this.sessionSequenceNumbers.delete(sessionId);
    
    // Clear any pending CWD check timers
    const cwdTimer = this.cwdCheckTimers.get(sessionId);
    if (cwdTimer) {
      clearTimeout(cwdTimer);
      this.cwdCheckTimers.delete(sessionId);
    }
    
    const outputTimer = this.outputUpdateTimers.get(sessionId);
    if (outputTimer) {
      clearTimeout(outputTimer);
      this.outputUpdateTimers.delete(sessionId);
    }

    // Update database
    await this.updateSessionInDb(session);

    this.fastify.log.info(`Killed terminal session: ${sessionId} for user ${userId}`);

    // Emit session list update event
    this.emit('session_deleted', sessionId);

    return true;
  }

  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty || session.status === 'dead') {
      return false;
    }

    // Buffer commands for history tracking
    if (data === '\r' || data === '\n') {
      const command = this.commandBuffer.get(sessionId) || '';
      this.fastify.log.info(`Enter pressed (${data === '\r' ? 'CR' : 'LF'}), command buffer: "${command}", length: ${command.length}`);
      if (command.trim()) {
        // Only record the command to history, don't predict CWD changes
        // Real CWD will be detected from shell output
        this.recordCommandOnly(sessionId, command.trim());
      }
      this.commandBuffer.delete(sessionId);
      
      // Schedule CWD check 1 second after Enter is pressed
      this.scheduleCWDCheck(sessionId, 1000);
    } else if (data === '\t') {
      // Tab completion - don't process yet, wait for Enter
      this.fastify.log.debug(`Tab completion in session ${sessionId}`);
    } else if (data === '\u007f' || data === '\b') {
      // Backspace
      const current = this.commandBuffer.get(sessionId) || '';
      this.commandBuffer.set(sessionId, current.slice(0, -1));
    } else if (data.charCodeAt(0) >= 32) {
      // Printable characters
      const current = this.commandBuffer.get(sessionId) || '';
      const newBuffer = current + data;
      this.commandBuffer.set(sessionId, newBuffer);
    }

    session.pty.write(data);
    this.updateActivity(sessionId);
    return true;
  }

  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty || session.status === 'dead') {
      return false;
    }

    session.pty.resize(cols, rows);
    return true;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getUserSessions(userId: string): SessionInfo[] {
    const allSessions = Array.from(this.sessions.values());
    const userSessions = allSessions.filter(s => s.userId === userId && s.status !== 'dead');
    
    this.fastify.log.info(`Getting sessions for user ${userId}: ${userSessions.length} of ${allSessions.length} total sessions`);
    userSessions.forEach(s => {
      this.fastify.log.info(`  - Session ${s.id}: ${s.name} (${s.status})`);
    });
    
    return userSessions.map(s => this.sessionToInfo(s));
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => this.sessionToInfo(s));
  }

  getSessionOutput(sessionId: string, chunks?: number): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const outputChunks = session.outputBuffer;
    if (chunks && chunks > 0) {
      return outputChunks.slice(-chunks);
    }
    
    return outputChunks;
  }

  private sessionToInfo(session: TerminalSession): SessionInfo {
    // Get last command from history
    const lastCommand = session.history.length > 0 
      ? session.history[session.history.length - 1]?.command 
      : undefined;
    
    // Check if there's a process running (simplified check)
    const isExecuting = this.isSessionExecuting(session);
    
    const sessionInfo = {
      id: session.id,
      name: session.name || 'Unnamed Session',
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      workingDir: session.workingDir,
      connectedClients: session.connectedClients,
      outputPreview: session.outputBuffer.slice(-3).join('').slice(-100), // Last 100 chars
      lastCommand: lastCommand,
      isExecuting: isExecuting
    };
    
    this.fastify.log.info(`SessionToInfo debug:`, {
      sessionId: session.id.slice(0, 8),
      originalWorkingDir: session.workingDir,
      workingDirLength: session.workingDir.length,
      resultWorkingDir: sessionInfo.workingDir,
      resultWorkingDirLength: sessionInfo.workingDir.length,
      lastCommand: lastCommand,
      historyLength: session.history.length
    });
    
    return sessionInfo;
  }
  
  private isSessionExecuting(session: TerminalSession): boolean {
    // Check if there's been recent output activity
    if (!session.outputBuffer.length) return false;
    
    const timeSinceActivity = Date.now() - session.lastActivity.getTime();
    
    // If very recent activity (within 3 seconds), likely executing
    if (timeSinceActivity < 3000) {
      return true;
    }
    
    // Check last few outputs for prompt patterns
    const recentOutput = session.outputBuffer.slice(-3).join('').trim();
    if (!recentOutput) return false;
    
    // Common prompt patterns that indicate shell is waiting for input
    const promptPatterns = [
      /[\$%>#]\s*$/,           // Basic shell prompts
      /^[^\n]*[\$%>#]\s*$/m,   // Prompt at end of line
      /\[.*\]\s*[\$%>#]\s*$/,  // Prompt with brackets
      />\s*$/,                // Simple > prompt
    ];
    
    // If ends with a prompt pattern, not executing
    for (const pattern of promptPatterns) {
      if (pattern.test(recentOutput)) {
        return false;
      }
    }
    
    // If recent activity but no prompt, probably executing
    return timeSinceActivity < 10000; // 10 seconds threshold
  }
  
  private analyzeTerminalOutput(sessionId: string, data: string): void {
    // Only check for execution status changes
    // CWD detection is now handled by getRealWorkingDirectory()
  }

  private async getRealWorkingDirectory(sessionId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return null;

    try {
      const pid = session.pty.pid;
      
      if (process.platform === 'darwin') {
        // macOS: use lsof to get the current working directory
        const { exec } = require('child_process');
        return new Promise((resolve) => {
          // Use a more specific lsof command to get just the working directory
          exec(`lsof -p ${pid} -a -d cwd | tail -n +2 | awk '{print $NF}'`, (error: any, stdout: string) => {
            if (error) {
              this.fastify.log.debug(`Failed to get CWD via lsof for PID ${pid}:`, error.message);
              resolve(null);
              return;
            }
            const lines = stdout.trim().split('\n').filter(Boolean);
            if (lines.length > 0) {
              // Use the first (and usually only) CWD entry
              const cwd = lines[0];
              this.fastify.log.debug(`Detected CWD for session ${sessionId} (PID ${pid}): ${cwd}`);
              resolve(cwd || null);
            } else {
              this.fastify.log.debug(`No CWD found for PID ${pid}`);
              resolve(null);
            }
          });
        });
      } else {
        // Linux: read from /proc/PID/cwd
        const fs = require('fs').promises;
        try {
          const cwd = await fs.readlink(`/proc/${pid}/cwd`);
          this.fastify.log.debug(`Detected CWD for session ${sessionId} (PID ${pid}): ${cwd}`);
          return cwd;
        } catch (error: any) {
          this.fastify.log.debug(`Failed to read /proc/${pid}/cwd:`, error.message);
          return null;
        }
      }
    } catch (error) {
      this.fastify.log.error(`Error getting real working directory for session ${sessionId}:`, error);
      return null;
    }
  }

  private async updateWorkingDirectoryFromProcess(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const realCwd = await this.getRealWorkingDirectory(sessionId);
    if (realCwd && realCwd !== session.workingDir) {
      this.fastify.log.info(`Real CWD detected: ${session.workingDir} -> ${realCwd}`);
      session.workingDir = realCwd;
      
      // Emit session update
      const sessionInfo = this.sessionToInfo(session);
      this.emit('session_updated', sessionInfo);
      return true;
    }
    return false;
  }

  private scheduleCWDCheck(sessionId: string, delay: number = 1000): void {
    // Clear existing timer if any
    const existingTimer = this.cwdCheckTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule new check
    const timer = setTimeout(async () => {
      await this.updateWorkingDirectoryFromProcess(sessionId);
      this.cwdCheckTimers.delete(sessionId);
    }, delay);
    
    this.cwdCheckTimers.set(sessionId, timer);
    this.fastify.log.debug(`Scheduled CWD check for session ${sessionId} in ${delay}ms`);
  }

  private scheduleOutputBasedCWDCheck(sessionId: string): void {
    // Clear existing output timer if any
    const existingTimer = this.outputUpdateTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule check after 1 second of no output activity
    const timer = setTimeout(async () => {
      await this.updateWorkingDirectoryFromProcess(sessionId);
      this.outputUpdateTimers.delete(sessionId);
      this.fastify.log.debug(`Output-based CWD check completed for session ${sessionId}`);
    }, 1000);
    
    this.outputUpdateTimers.set(sessionId, timer);
  }

  private async addToOutputBuffer(sessionId: string, data: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Store raw data chunks to preserve ANSI escape sequences and formatting
    session.outputBuffer.push(data);
    
    // Keep only the last N chunks to prevent memory issues
    if (session.outputBuffer.length > this.maxOutputBuffer) {
      session.outputBuffer = session.outputBuffer.slice(-this.maxOutputBuffer);
    }

    // Check for working directory changes and execution status
    this.analyzeTerminalOutput(sessionId, data);
    
    // Schedule output-based CWD check (resets timer each time there's new output)
    this.scheduleOutputBasedCWDCheck(sessionId);
    
    // Check if execution status changed and emit update
    const wasExecuting = this.isSessionExecuting(session);
    
    // After adding new data, check execution status again
    setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session) {
        const nowExecuting = this.isSessionExecuting(session);
        if (wasExecuting !== nowExecuting) {
          // Execution status changed, emit update
          this.fastify.log.info(`Session ${sessionId} execution status changed: ${wasExecuting} -> ${nowExecuting}`);
          this.emit('session_updated', this.sessionToInfo(session));
        }
      }
    }, 100); // Small delay to let the output settle

    // Log buffer size periodically for debugging
    if (session.outputBuffer.length % 20 === 0) {
      this.fastify.log.info(`Session ${sessionId} output buffer size: ${session.outputBuffer.length} chunks`);
    }

    // Persist to database periodically
    try {
      // Use incrementing sequence number for this session
      if (!this.sessionSequenceNumbers) {
        this.sessionSequenceNumbers = new Map<string, number>();
      }
      const currentSeq = this.sessionSequenceNumbers.get(sessionId) || 0;
      const sequenceNumber = currentSeq + 1;
      this.sessionSequenceNumbers.set(sessionId, sequenceNumber);
      
      const client = await this.fastify.pg.connect();
      await client.query(
        'INSERT INTO session_output_buffer (session_id, output_data, sequence_number, timestamp) VALUES ($1, $2, $3, $4)',
        [sessionId, data, sequenceNumber, new Date()]
      );
      client.release();
    } catch (err: any) {
      this.fastify.log.error('Failed to save output buffer to database:', {
        error: err.message,
        sessionId: sessionId,
        dataLength: data.length
      });
      // Don't throw error - allow terminal to continue working even if DB save fails
    }
  }

  private updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const oldActivity = session.lastActivity;
      const oldExecuting = this.isSessionExecuting(session);
      session.lastActivity = new Date();
      
      // Check if execution status might have changed
      setTimeout(() => {
        const session = this.sessions.get(sessionId);
        if (session) {
          const nowExecuting = this.isSessionExecuting(session);
          const timeDiff = session.lastActivity.getTime() - oldActivity.getTime();
          
          // Emit update if execution status changed or significant time passed
          if (oldExecuting !== nowExecuting || timeDiff > 3000) {
            this.fastify.log.info(`Session ${sessionId} activity update - executing: ${oldExecuting} -> ${nowExecuting}`);
            this.emit('session_updated', this.sessionToInfo(session));
          }
        }
      }, 100);
      
      // Update database asynchronously (don't await to avoid blocking)
      this.updateSessionInDb(session).catch(err => {
        this.fastify.log.error('Failed to update session activity in database:', err);
      });
    }
  }

  private normalizePath(path: string): string {
    this.fastify.log.info(`NormalizePath input: "${path}", length: ${path.length}`);
    
    // Remove multiple consecutive slashes
    path = path.replace(/\/+/g, '/');
    this.fastify.log.info(`After slash normalization: "${path}", length: ${path.length}`);
    
    // Split into parts and resolve . and ..
    const parts = path.split('/').filter(p => p.length > 0);
    this.fastify.log.info(`Path parts:`, parts);
    
    const resolved = [];
    
    for (const part of parts) {
      if (part === '.') {
        // Current directory, skip
        continue;
      } else if (part === '..') {
        // Parent directory
        if (resolved.length > 0) {
          resolved.pop();
        }
      } else {
        resolved.push(part);
      }
    }
    
    this.fastify.log.info(`Resolved parts:`, resolved);
    
    // Rebuild path
    const result = '/' + resolved.join('/');
    this.fastify.log.info(`NormalizePath result: "${result}", length: ${result.length}`);
    return result === '/' ? '/' : result;
  }

  private async recordCommandOnly(sessionId: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.fastify.log.info(`Recording command for session ${sessionId}: ${command}`);

    const commandRecord: CommandHistory = {
      id: crypto.randomUUID(),
      sessionId,
      command,
      output: '',
      exitCode: null,
      timestamp: new Date(),
      duration: 0
    };

    session.history.push(commandRecord);

    // Save to database
    try {
      const client = await this.fastify.pg.connect();
      await client.query(
        'INSERT INTO command_history (session_id, command, timestamp) VALUES ($1, $2, $3)',
        [sessionId, command, commandRecord.timestamp]
      );
      client.release();
    } catch (err) {
      this.fastify.log.error('Failed to save command history:', err);
    }

    this.emit('command', sessionId, commandRecord);
    
    // Emit session update for command change
    const sessionInfo = this.sessionToInfo(session);
    this.emit('session_updated', sessionInfo);
  }

  private async processCommand(sessionId: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.fastify.log.info(`Processing command for session ${sessionId}: ${command}`);

    // Predict working directory changes for cd commands
    if (command.startsWith('cd ')) {
      const targetDir = command.substring(3).trim();
      this.fastify.log.info(`CD command detected: "${command}", target: "${targetDir}"`);
      
      if (targetDir) {
        let newWorkingDir = session.workingDir;
        
        if (targetDir === '..') {
          const parts = session.workingDir.split('/').filter(p => p.length > 0);
          newWorkingDir = '/' + parts.slice(0, -1).join('/');
          if (newWorkingDir === '/') newWorkingDir = '/';
        } else if (targetDir.startsWith('./')) {
          newWorkingDir = session.workingDir.endsWith('/') 
            ? session.workingDir + targetDir.substring(2)
            : session.workingDir + '/' + targetDir.substring(2);
        } else if (targetDir.startsWith('/')) {
          newWorkingDir = targetDir;
        } else if (targetDir === '~') {
          newWorkingDir = process.env.HOME || '/home/' + (process.env.USER || 'user');
        } else if (targetDir.startsWith('~/')) {
          const homeDir = process.env.HOME || '/home/' + (process.env.USER || 'user');
          newWorkingDir = homeDir + '/' + targetDir.substring(2);
        } else {
          // Relative path
          newWorkingDir = session.workingDir.endsWith('/') 
            ? session.workingDir + targetDir
            : session.workingDir + '/' + targetDir;
        }
        
        // Normalize path (remove double slashes, resolve . and ..)
        newWorkingDir = this.normalizePath(newWorkingDir);
        
        this.fastify.log.info(`Working directory change: ${session.workingDir} -> ${newWorkingDir}`);
        this.fastify.log.info(`New working dir length: ${newWorkingDir.length}, content: "${newWorkingDir}"`);
        session.workingDir = newWorkingDir;
        this.fastify.log.info(`Session workingDir after assignment: "${session.workingDir}", length: ${session.workingDir.length}`);
      }
    }

    // Record the command
    await this.recordCommand(sessionId, command);
  }

  private async recordCommand(sessionId: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const commandRecord: CommandHistory = {
      id: crypto.randomUUID(),
      sessionId,
      command,
      output: '',
      exitCode: null,
      timestamp: new Date(),
      duration: 0
    };

    session.history.push(commandRecord);

    // Save to database
    try {
      const client = await this.fastify.pg.connect();
      await client.query(
        'INSERT INTO command_history (session_id, command, timestamp) VALUES ($1, $2, $3)',
        [sessionId, command, commandRecord.timestamp]
      );
      client.release();
    } catch (err) {
      this.fastify.log.error('Failed to save command history:', err);
    }

    this.emit('command', sessionId, commandRecord);
    
    // Emit session update for last command change (and potential CWD change)
    const sessionInfo = this.sessionToInfo(session);
    this.fastify.log.info(`Emitting session_updated event for command processing:`, sessionInfo);
    this.emit('session_updated', sessionInfo);
  }

  private async saveSessionToDb(session: TerminalSession): Promise<void> {
    try {
      const client = await this.fastify.pg.connect();
      await client.query(
        `INSERT INTO persistent_sessions (id, user_id, name, working_dir, environment, status, created_at, last_activity) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         last_activity = EXCLUDED.last_activity`,
        [
          session.id, 
          session.userId, 
          session.name, 
          session.workingDir, 
          JSON.stringify(session.environment),
          session.status,
          session.createdAt,
          session.lastActivity
        ]
      );
      client.release();
      this.fastify.log.info(`Session ${session.id} saved to database successfully`);
    } catch (err: any) {
      this.fastify.log.error('Failed to save session to database:', {
        error: err.message,
        stack: err.stack,
        sessionId: session.id,
        userId: session.userId
      });
      // Don't throw error - allow session creation to continue even if DB save fails
    }
  }

  private async updateSessionInDb(session: TerminalSession): Promise<void> {
    try {
      const client = await this.fastify.pg.connect();
      await client.query(
        'UPDATE persistent_sessions SET status = $1, last_activity = $2 WHERE id = $3',
        [session.status, session.lastActivity, session.id]
      );
      client.release();
    } catch (err) {
      this.fastify.log.error('Failed to update session in database:', err);
    }
  }

  private async restoreSessionFromDb(sessionId: string, userId: string): Promise<TerminalSession> {
    let client;
    try {
      client = await this.fastify.pg.connect();
      const result = await client.query(
        'SELECT * FROM persistent_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      if (result.rows.length === 0) {
        client.release();
        throw new Error('Session not found');
      }

      const row = result.rows[0];
      
      // Recreate the session
      const restoredSession = await this.createSession(userId, {
        sessionId: row.id,
        name: row.name,
        workingDir: row.working_dir,
        environment: JSON.parse(row.environment || '{}')
      });

      // Restore output buffer from database
      try {
        const bufferResult = await client.query(
          'SELECT output_data, sequence_number FROM session_output_buffer WHERE session_id = $1 ORDER BY sequence_number DESC LIMIT $2',
          [sessionId, this.maxOutputBuffer]
        );
        
        // Reverse to get chronological order
        const outputChunks = bufferResult.rows.map((r: any) => r.output_data).reverse();
        restoredSession.outputBuffer = outputChunks;
        
        // Set the sequence number to continue from where we left off
        if (bufferResult.rows.length > 0) {
          const maxSequence = Math.max(...bufferResult.rows.map((r: any) => r.sequence_number));
          this.sessionSequenceNumbers.set(sessionId, maxSequence);
        }
        
        this.fastify.log.info(`Restored session ${sessionId} with ${outputChunks.length} output chunks from database for user ${userId}`);
      } catch (err) {
        this.fastify.log.error('Failed to restore output buffer from database:', err);
      }

      client.release();
      return restoredSession;
    } catch (err) {
      if (client) {
        client.release();
      }
      this.fastify.log.error('Failed to restore session from database:', err);
      throw err;
    }
  }

  private async loadActiveSessionsFromDatabase(): Promise<void> {
    let client;
    try {
      client = await this.fastify.pg.connect();
      
      // Load all active and detached sessions from database
      const result = await client.query(
        `SELECT * FROM persistent_sessions 
         WHERE status IN ('active', 'detached') 
         ORDER BY last_activity DESC`
      );
      
      this.fastify.log.info(`Found ${result.rows.length} sessions in database to restore`);
      
      for (const row of result.rows) {
        try {
          this.fastify.log.info(`Processing session from DB: ${row.id} (${row.name})`);
          
          // Check if session already exists in memory
          if (this.sessions.has(row.id)) {
            this.fastify.log.info(`Session ${row.id} already exists in memory, skipping`);
            continue;
          }
          
          // Create session object without PTY (sessions are detached)
          const session: TerminalSession = {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            pty: undefined, // No PTY for loaded sessions until reattached
            history: [],
            createdAt: new Date(row.created_at),
            lastActivity: new Date(row.last_activity),
            workingDir: row.working_dir,
            environment: typeof row.environment === 'string' ? JSON.parse(row.environment) : row.environment || {},
            status: 'detached', // Always detached when loaded from DB
            outputBuffer: [],
            connectedClients: 0
          };
          
          // Load output buffer from database
          try {
            const bufferResult = await client.query(
              'SELECT output_data, sequence_number FROM session_output_buffer WHERE session_id = $1 ORDER BY sequence_number DESC LIMIT $2',
              [row.id, this.maxOutputBuffer]
            );
            
            // Reverse to get chronological order
            const outputChunks = bufferResult.rows.map((r: any) => r.output_data).reverse();
            session.outputBuffer = outputChunks;
            
            // Set the sequence number to continue from where we left off
            if (bufferResult.rows.length > 0) {
              const maxSequence = Math.max(...bufferResult.rows.map((r: any) => r.sequence_number));
              this.sessionSequenceNumbers.set(row.id, maxSequence);
            }
            
            this.fastify.log.info(`Loaded session ${row.id} (${row.name}) with ${outputChunks.length} output chunks`);
          } catch (err) {
            this.fastify.log.error(`Failed to load output buffer for session ${row.id}:`, err);
          }
          
          // Add session to memory
          this.sessions.set(row.id, session);
          
        } catch (err: any) {
          this.fastify.log.error(`Failed to restore session ${row.id}:`, err);
          this.fastify.log.error('Error details:', { message: err.message, stack: err.stack });
        }
      }
      
      this.fastify.log.info(`Successfully restored ${this.sessions.size} sessions to memory`);
      
      client.release();
    } catch (err) {
      if (client) {
        client.release();
      }
      this.fastify.log.error('Failed to load sessions from database:', err);
    }
  }

  private auditConnectionCounts(): void {
    let hasChanges = false;
    
    this.sessions.forEach((session, sessionId) => {
      // If a session has been detached for more than 5 minutes but still shows connected clients,
      // it's likely a stale count - reset it
      if (session.status === 'detached' && session.connectedClients > 0) {
        const timeSinceActivity = Date.now() - session.lastActivity.getTime();
        if (timeSinceActivity > 5 * 60 * 1000) { // 5 minutes
          this.fastify.log.warn(`Resetting stale connection count for session ${sessionId}: was ${session.connectedClients}, now 0`);
          session.connectedClients = 0;
          hasChanges = true;
          
          // Emit update event
          const sessionInfo = this.sessionToInfo(session);
          this.emit('session_updated', sessionInfo);
        }
      }
    });
    
    if (hasChanges) {
      this.fastify.log.info('Connection count audit completed with changes');
    }
  }
  
  private async cleanupDeadSessions(): Promise<void> {
    const now = new Date();
    const deadSessionThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'dead' && 
          now.getTime() - session.lastActivity.getTime() > deadSessionThreshold) {
        
        this.sessions.delete(sessionId);
        this.commandBuffer.delete(sessionId);
        this.sessionSequenceNumbers.delete(sessionId);
        
        // Clear any pending CWD check timers
        const cwdTimer = this.cwdCheckTimers.get(sessionId);
        if (cwdTimer) {
          clearTimeout(cwdTimer);
          this.cwdCheckTimers.delete(sessionId);
        }
        
        const outputTimer = this.outputUpdateTimers.get(sessionId);
        if (outputTimer) {
          clearTimeout(outputTimer);
          this.outputUpdateTimers.delete(sessionId);
        }
        
        this.fastify.log.info(`Cleaned up dead session: ${sessionId}`);
      }
    }

    // Clean up old output buffer entries from database
    try {
      const client = await this.fastify.pg.connect();
      // Delete output buffer entries older than 7 days
      await client.query(
        'DELETE FROM session_output_buffer WHERE timestamp < NOW() - INTERVAL \'7 days\''
      );
      client.release();
    } catch (err) {
      this.fastify.log.error('Failed to clean up old output buffer entries:', err);
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.fastify.log.info('Shutting down SessionManager...');
    
    // Update all sessions as detached
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        session.status = 'detached';
        session.connectedClients = 0;
        await this.updateSessionInDb(session);
      }
    }
  }
}