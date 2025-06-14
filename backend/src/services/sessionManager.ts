import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { TerminalSession, CommandHistory } from '../types';

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

  constructor(private fastify: any) {
    super();
    
    // Cleanup dead sessions periodically
    setInterval(() => {
      this.cleanupDeadSessions();
    }, 60000); // Every minute
    
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

    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const workingDir = options.workingDir || process.env.HOME || '/tmp';
    
    const ptyProcess = pty.spawn(shell, [], {
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
    this.emit('session_created', this.sessionToInfo(session));
    
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
    this.emit('session_updated', this.sessionToInfo(session));

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
    this.emit('session_updated', this.sessionToInfo(session));

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
    if (data === '\r') {
      const command = this.commandBuffer.get(sessionId) || '';
      if (command.trim()) {
        this.recordCommand(sessionId, command.trim());
      }
      this.commandBuffer.delete(sessionId);
    } else if (data === '\u007f' || data === '\b') {
      // Backspace
      const current = this.commandBuffer.get(sessionId) || '';
      this.commandBuffer.set(sessionId, current.slice(0, -1));
    } else if (data.charCodeAt(0) >= 32) {
      // Printable characters
      const current = this.commandBuffer.get(sessionId) || '';
      this.commandBuffer.set(sessionId, current + data);
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
    
    return {
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
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Look for working directory changes (cd commands and pwd output)
    const cdPattern = /(?:^|\n).*?[\$%>#]\s*cd\s+([^\s\n]+)/;
    const pwdPattern = /(?:^|\n)([^\/\n]*\/[^\n]+)(?=\s*[\$%>#]|\n|$)/;
    
    let shouldUpdate = false;
    
    // Check for cd command
    const cdMatch = data.match(cdPattern);
    if (cdMatch && cdMatch[1]) {
      let newDir = cdMatch[1];
      // Handle relative paths
      if (newDir === '..') {
        const parts = session.workingDir.split('/');
        newDir = parts.slice(0, -1).join('/') || '/';
      } else if (newDir.startsWith('./')) {
        newDir = session.workingDir + '/' + newDir.substring(2);
      } else if (!newDir.startsWith('/')) {
        newDir = session.workingDir + '/' + newDir;
      }
      
      if (newDir !== session.workingDir) {
        this.fastify.log.info(`Session ${sessionId} working directory changed: ${session.workingDir} -> ${newDir}`);
        session.workingDir = newDir;
        shouldUpdate = true;
      }
    }
    
    // Check for pwd output or prompt with path
    const pwdMatch = data.match(pwdPattern);
    if (pwdMatch && pwdMatch[1] && pwdMatch[1].startsWith('/')) {
      const newDir = pwdMatch[1];
      if (newDir !== session.workingDir) {
        this.fastify.log.info(`Session ${sessionId} working directory detected: ${session.workingDir} -> ${newDir}`);
        session.workingDir = newDir;
        shouldUpdate = true;
      }
    }
    
    // Check for command execution patterns
    const commandPattern = /(?:^|\n).*?[\$%>#]\s*([^\n]+?)\s*(?:\n|$)/;
    const commandMatch = data.match(commandPattern);
    if (commandMatch && commandMatch[1] && commandMatch[1].trim() && !commandMatch[1].includes('$')) {
      const command = commandMatch[1].trim();
      // Don't record really short commands or prompts
      if (command.length > 2 && !command.match(/^[\$%>#]+$/)) {
        this.fastify.log.info(`Session ${sessionId} detected command: ${command}`);
        // Update last command immediately
        const commandRecord = {
          id: crypto.randomUUID(),
          sessionId,
          command,
          output: '',
          exitCode: null,
          timestamp: new Date(),
          duration: 0
        };
        session.history.push(commandRecord);
        shouldUpdate = true;
      }
    }
    
    if (shouldUpdate) {
      // Emit update with delay to batch multiple changes
      setTimeout(() => {
        const session = this.sessions.get(sessionId);
        if (session) {
          this.emit('session_updated', this.sessionToInfo(session));
        }
      }, 200);
    }
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
    
    // Emit session update for last command change
    this.emit('session_updated', this.sessionToInfo(session));
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

  private async cleanupDeadSessions(): Promise<void> {
    const now = new Date();
    const deadSessionThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'dead' && 
          now.getTime() - session.lastActivity.getTime() > deadSessionThreshold) {
        
        this.sessions.delete(sessionId);
        this.commandBuffer.delete(sessionId);
        this.sessionSequenceNumbers.delete(sessionId);
        
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