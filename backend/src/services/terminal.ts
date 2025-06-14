import { spawn } from 'node-pty';
import { EventEmitter } from 'events';
import { TerminalSession, CommandHistory } from '../types';

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, TerminalSession>();
  private commandBuffer = new Map<string, string>();

  constructor(private fastify: any) {
    super();
  }

  async createSession(userId: string, sessionId: string): Promise<TerminalSession> {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    
    const pty = spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/tmp',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    const session: TerminalSession = {
      id: sessionId,
      userId,
      pty,
      history: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      workingDir: process.env.HOME || '/tmp',
      environment: {}
    };

    // Handle PTY data
    pty.onData((data: string) => {
      this.emit('data', sessionId, data);
      this.updateActivity(sessionId);
    });

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      this.fastify.log.info(`Terminal session ${sessionId} exited`, { exitCode, signal });
      this.emit('exit', sessionId, exitCode);
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);

    // Save session to database
    await this.saveSessionToDb(session);

    return session;
  }

  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) {
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
    if (!session || !session.pty) {
      return false;
    }

    session.pty.resize(cols, rows);
    return true;
  }

  async killSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) {
      return false;
    }

    session.pty.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  getUserSessions(userId: string): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
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
        'INSERT INTO terminal_sessions (id, user_id, working_dir, environment, created_at) VALUES ($1, $2, $3, $4, $5)',
        [session.id, session.userId, session.workingDir, JSON.stringify(session.environment), session.createdAt]
      );
      client.release();
    } catch (err) {
      this.fastify.log.error('Failed to save session to database:', err);
    }
  }

  async getSessionHistory(sessionId: string): Promise<CommandHistory[]> {
    try {
      const client = await this.fastify.pg.connect();
      const result = await client.query(
        'SELECT * FROM command_history WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 100',
        [sessionId]
      );
      client.release();

      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        command: row.command,
        output: row.output || '',
        exitCode: row.exit_code,
        timestamp: row.timestamp,
        duration: row.duration || 0
      }));
    } catch (err) {
      this.fastify.log.error('Failed to get session history:', err);
      return [];
    }
  }
}