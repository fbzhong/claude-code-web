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
        session.pty = null;
      }
      this.emit('exit', sessionId, exitCode);
    });

    this.sessions.set(sessionId, session);

    // Save session to database
    await this.saveSessionToDb(session);

    this.fastify.log.info(`Created new terminal session: ${sessionId} (${sessionName}) for user ${userId}`);
    
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
    
    // Remove from memory after a short delay (allow clients to be notified)
    setTimeout(() => {
      this.sessions.delete(sessionId);
      this.commandBuffer.delete(sessionId);
      this.sessionSequenceNumbers.delete(sessionId);
    }, 5000);

    // Update database
    await this.updateSessionInDb(session);

    this.fastify.log.info(`Killed terminal session: ${sessionId} for user ${userId}`);

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
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .map(s => this.sessionToInfo(s));
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
    return {
      id: session.id,
      name: session.name || 'Unnamed Session',
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      workingDir: session.workingDir,
      connectedClients: session.connectedClients,
      outputPreview: session.outputBuffer.slice(-3).join('').slice(-100) // Last 100 chars
    };
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
    } catch (err) {
      this.fastify.log.error('Failed to save output buffer to database:', err);
    }
  }

  private updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
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
    } catch (err) {
      this.fastify.log.error('Failed to save session to database:', err);
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
        const outputChunks = bufferResult.rows.map(r => r.output_data).reverse();
        restoredSession.outputBuffer = outputChunks;
        
        // Set the sequence number to continue from where we left off
        if (bufferResult.rows.length > 0) {
          const maxSequence = Math.max(...bufferResult.rows.map(r => r.sequence_number));
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