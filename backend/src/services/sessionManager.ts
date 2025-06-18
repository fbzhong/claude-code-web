import * as pty from "node-pty";
import { EventEmitter } from "events";
import * as crypto from "crypto";
import { TerminalSession, CommandHistory } from "../types";
import { ContainerManager } from "./containerManager";
import { PtyAdapter } from "./ptyAdapter";

export interface SessionInfo {
  id: string;
  name: string;
  status: "active" | "detached" | "dead";
  createdAt: Date;
  lastActivity: Date;
  workingDir: string;
  connectedClients: number;
  outputPreview?: string;
  lastCommand?: string;
  isExecuting?: boolean;
  deviceId?: string;
}

export class SessionManager extends EventEmitter {
  private static instance: SessionManager | null = null;
  private sessions = new Map<string, TerminalSession>();
  private commandBuffer = new Map<string, string>();
  private sessionSequenceNumbers = new Map<string, number>();
  private maxOutputBuffer = parseInt(process.env.MAX_OUTPUT_BUFFER || '5000'); // Maximum chunks to keep in memory
  private maxOutputBufferBytes = parseInt(process.env.MAX_OUTPUT_BUFFER_MB || '5') * 1024 * 1024; // Default 5MB
  private reconnectHistorySize = parseInt(process.env.RECONNECT_HISTORY_SIZE || '500'); // Chunks to send on reconnect
  private maxSessions = 50; // Maximum sessions per user
  private cwdCheckTimers = new Map<string, NodeJS.Timeout>(); // Timers for CWD checking
  private outputUpdateTimers = new Map<string, NodeJS.Timeout>(); // Timers for output update delays
  private containerManager?: ContainerManager;
  private useContainers: boolean;
  private readonly useDockerode: boolean = true;
  private userDeviceSessions = new Map<string, string>(); // Map of "userId-deviceId" -> sessionId
  private sessionBufferBytes = new Map<string, number>(); // Track buffer size in bytes per session

  constructor(private fastify: any) {
    super();

    // Buffer configuration (logged at debug level)
    this.fastify.log.debug('SessionManager buffer configuration:', {
      maxOutputBuffer: this.maxOutputBuffer,
      maxOutputBufferMB: this.maxOutputBufferBytes / 1024 / 1024,
      reconnectHistorySize: this.reconnectHistorySize,
    });

    // Check if container mode is enabled
    this.useContainers = process.env.CONTAINER_MODE?.toLowerCase() === "true";

    if (this.useContainers) {
      this.containerManager = new ContainerManager(fastify);
      // Register containerManager on fastify instance for other routes to access
      fastify.decorate("containerManager", this.containerManager);
      this.fastify.log.debug(
        `Container mode enabled (dockerode: ${this.useDockerode})`
      );
    } else {
      this.fastify.log.debug("Local shell mode enabled");
      // SSHConfigManager will be initialized by database plugin
    }

    // Cleanup dead sessions periodically
    setInterval(() => {
      this.cleanupDeadSessions();
    }, 60000); // Every minute

    // Audit connection counts periodically
    setInterval(() => {
      this.auditConnectionCounts();
    }, 30000); // Every 30 seconds

    // Sessions are now ephemeral - no database persistence
  }

  static getInstance(fastify: any): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(fastify);
    }
    return SessionManager.instance;
  }

  /**
   * Get or create a session for a specific user and device
   */
  async getOrCreateSessionForDevice(
    userId: string,
    deviceId: string,
    options: {
      name?: string;
      workingDir?: string;
      environment?: Record<string, string>;
    } = {}
  ): Promise<TerminalSession> {
    const deviceKey = `${userId}-${deviceId}`;
    
    // Check if we already have a session for this device
    const existingSessionId = this.userDeviceSessions.get(deviceKey);
    
    if (existingSessionId) {
      const session = this.sessions.get(existingSessionId);
      
      // If session exists and is alive, return it
      if (session && session.status !== "dead") {
        this.fastify.log.debug(
          `Reusing existing session ${existingSessionId} for device ${deviceKey}`
        );
        return session;
      }
      
      // Session is dead or missing, clean up the reference
      this.userDeviceSessions.delete(deviceKey);
      
      // Also clean up any other sessions for this user on different devices
      this.cleanupUserOldDeviceSessions(userId, deviceId);
    }
    
    // Create new session with device ID
    const newSession = await this.createSession(userId, {
      ...options,
      deviceId,
      name: options.name || `Device ${deviceId.substring(0, 8)}`
    });
    
    // Register the device-session mapping
    this.userDeviceSessions.set(deviceKey, newSession.id);
    
    this.fastify.log.debug(
      `Created new session ${newSession.id} for device ${deviceKey}`
    );
    
    return newSession;
  }

  /**
   * Clean up old sessions from other devices for the same user
   */
  private cleanupUserOldDeviceSessions(userId: string, currentDeviceId: string): void {
    const sessionsToKill: string[] = [];
    
    // Find all device keys for this user
    for (const [deviceKey, sessionId] of this.userDeviceSessions.entries()) {
      if (deviceKey.startsWith(`${userId}-`) && !deviceKey.endsWith(currentDeviceId)) {
        const session = this.sessions.get(sessionId);
        
        // Only clean up detached or inactive sessions
        if (session && (session.status === "detached" || session.connectedClients === 0)) {
          sessionsToKill.push(sessionId);
          this.userDeviceSessions.delete(deviceKey);
        }
      }
    }
    
    // Kill the old sessions
    for (const sessionId of sessionsToKill) {
      this.fastify.log.debug(
        `Cleaning up old session ${sessionId} for user ${userId}`
      );
      this.killSession(sessionId, userId);
    }
  }

  async createSession(
    userId: string,
    options: {
      sessionId?: string;
      name?: string;
      workingDir?: string;
      environment?: Record<string, string>;
      deviceId?: string;
    } = {}
  ): Promise<TerminalSession> {
    const sessionId = options.sessionId || crypto.randomUUID();
    const sessionName =
      options.name || `Session ${this.getUserSessions(userId).length + 1}`;

    // Check session limit
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length >= this.maxSessions) {
      throw new Error(
        `Maximum number of sessions (${this.maxSessions}) reached`
      );
    }

    let ptyProcess: any;
    let workingDir: string;

    if (this.useContainers && this.containerManager) {
      // Container mode - each user gets their own container
      this.fastify.log.debug(
        `[SessionManager] Creating containerized session for user ${userId}`
      );

      try {
        // Get or create user's container
        this.fastify.log.debug(
          `[SessionManager] Getting container for user ${userId}...`
        );
        const containerId =
          await this.containerManager.getOrCreateUserContainer(userId);
        this.fastify.log.debug(
          `[SessionManager] Got container ${containerId} for user ${userId}`
        );

        // Use container's home directory as default
        workingDir = options.workingDir || "/home/developer";

        this.fastify.log.debug(
          `[SessionManager] Creating dockerode exec session in container ${containerId}...`
        );

        const execSession = await this.containerManager.createExecSession(
          containerId,
          {
            cmd: ["/bin/bash"],
            workingDir,
            user: "developer",
            env: {
              TERM: "xterm-256color",
              COLORTERM: "truecolor",
            },
          }
        );

        // Create PTY adapter
        ptyProcess = new PtyAdapter(execSession, sessionId);

        this.fastify.log.debug(
          `[SessionManager] Created dockerode exec session for ${sessionId} in container ${containerId}`
        );
      } catch (error: any) {
        this.fastify.log.error(
          `Failed to create containerized session:`,
          error
        );
        throw new Error(
          `Failed to create containerized session: ${error.message}`
        );
      }
    } else {
      // Local mode - use host shell
      const shell = process.platform === "win32" ? "powershell.exe" : "bash";
      workingDir = options.workingDir || process.env.HOME || "/tmp";

      this.fastify.log.debug(
        `Creating local session with workingDir: "${workingDir}"`
      );

      try {
        ptyProcess = pty.spawn(shell, [], {
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd: workingDir,
          env: {
            ...process.env,
            ...options.environment,
            TERM: "xterm-256color",
            COLORTERM: "truecolor",
          },
        });
        
        this.fastify.log.debug(`[SessionManager] PTY created successfully:`, {
          pid: ptyProcess.pid,
          process: ptyProcess.process,
          sessionId: sessionId
        });
      } catch (error: any) {
        this.fastify.log.error(`[SessionManager] Failed to create PTY:`, error);
        throw new Error(`Failed to create PTY: ${error.message}`);
      }
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
      status: "active",
      outputBuffer: [],
      connectedClients: 0,
      deviceId: options.deviceId,
    };

    // Handle PTY data and buffer output
    ptyProcess.onData((data: string) => {
      this.addToOutputBuffer(sessionId, data); // Note: this is now async but we don't await to avoid blocking
      this.emit("data", sessionId, data);
      this.updateActivity(sessionId);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      this.fastify.log.warn(`Terminal session ${sessionId} exited`, {
        exitCode,
        signal,
      });
      
      // Emit exit event first to notify clients
      this.emit("exit", sessionId, exitCode);
      
      // Immediately kill the session to clean up and emit session_deleted event
      // This ensures the session is removed from memory and API responses
      this.killSession(sessionId, userId);
    });

    this.sessions.set(sessionId, session);
    this.sessionBufferBytes.set(sessionId, 0); // Initialize buffer byte counter

    // Sessions are ephemeral - no database persistence

    this.fastify.log.debug(
      `Created new terminal session: ${sessionId} (${sessionName}) for user ${userId}`
    );

    // Emit session list update event
    const sessionInfo = this.sessionToInfo(session);
    this.emit("session_created", sessionInfo);

    return session;
  }

  async attachToSession(
    sessionId: string,
    userId: string,
    deviceId?: string
  ): Promise<TerminalSession> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      // Sessions are ephemeral - cannot be restored after disconnect
      throw new Error("Session not found or has been terminated");
    }

    if (session.userId !== userId) {
      throw new Error("Access denied: session belongs to another user");
    }

    if (session.status === "dead") {
      throw new Error("Cannot attach to dead session");
    }

    // Log device attachment for monitoring
    if (deviceId) {
      this.fastify.log.debug(
        `Device ${deviceId} attaching to session ${sessionId}`
      );
    }

    // Increment connected clients
    session.connectedClients++;
    session.status = "active";
    session.lastActivity = new Date();

    this.fastify.log.debug(
      `User ${userId} attached to session ${sessionId} (${session.connectedClients} clients)`
    );

    // Emit session list update event
    const sessionInfo = this.sessionToInfo(session);
    this.emit("session_updated", sessionInfo);

    return session;
  }

  detachFromSession(sessionId: string, userId: string, deviceId?: string): boolean {
    const session = this.sessions.get(sessionId);

    if (!session || session.userId !== userId) {
      return false;
    }

    session.connectedClients = Math.max(0, session.connectedClients - 1);

    if (session.connectedClients === 0 && session.status === "active") {
      session.status = "detached";
      
      // If this was a device-specific session, schedule cleanup
      if (deviceId && session.deviceId === deviceId) {
        this.scheduleSessionCleanup(sessionId, userId, deviceId);
      }
    }

    this.fastify.log.debug(
      `User ${userId} detached from session ${sessionId} (${session.connectedClients} clients remaining)`
    );

    // Emit session list update event
    const sessionInfo = this.sessionToInfo(session);
    this.emit("session_updated", sessionInfo);

    return true;
  }

  /**
   * Schedule cleanup for a detached session
   */
  private scheduleSessionCleanup(sessionId: string, userId: string, deviceId: string): void {
    // Wait 10 minutes before cleaning up detached device sessions
    const cleanupDelay = 10 * 60 * 1000; // 10 minutes
    
    setTimeout(() => {
      const session = this.sessions.get(sessionId);
      
      // Only clean up if still detached and no clients
      if (session && session.status === "detached" && session.connectedClients === 0) {
        this.fastify.log.debug(
          `Auto-cleaning detached session ${sessionId} for device ${deviceId}`
        );
        
        // Remove from device mapping
        const deviceKey = `${userId}-${deviceId}`;
        if (this.userDeviceSessions.get(deviceKey) === sessionId) {
          this.userDeviceSessions.delete(deviceKey);
        }
        
        // Kill the session
        this.killSession(sessionId, userId);
      }
    }, cleanupDelay);
  }

  async killSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session || session.userId !== userId) {
      return false;
    }

    if (session.pty) {
      session.pty.kill();
    }

    session.status = "dead";

    // Remove from memory immediately (clients will get updated via API refresh)
    this.sessions.delete(sessionId);
    this.commandBuffer.delete(sessionId);
    this.sessionSequenceNumbers.delete(sessionId);
    this.sessionBufferBytes.delete(sessionId);

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

    // Sessions are ephemeral - no database updates

    this.fastify.log.debug(
      `Killed terminal session: ${sessionId} for user ${userId}`
    );

    // Emit session list update event
    this.emit("session_deleted", sessionId);

    return true;
  }

  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    
    
    if (!session || !session.pty || session.status === "dead") {
      this.fastify.log.warn(`[SessionManager] Cannot write to session ${sessionId}: session not ready`);
      return false;
    }

    // Buffer commands for history tracking
    if (data === "\r" || data === "\n") {
      const command = this.commandBuffer.get(sessionId) || "";
      if (command.trim()) {
        // Only record the command to history, don't predict CWD changes
        // Real CWD will be detected from shell output
        this.recordCommandOnly(sessionId, command.trim());
      }
      this.commandBuffer.delete(sessionId);

      // Schedule CWD check 1 second after Enter is pressed
      this.scheduleCWDCheck(sessionId, 1000);
    } else if (data === "\t") {
      // Tab completion - don't process yet, wait for Enter
      this.fastify.log.debug(`Tab completion in session ${sessionId}`);
    } else if (data === "\u007f" || data === "\b") {
      // Backspace
      const current = this.commandBuffer.get(sessionId) || "";
      this.commandBuffer.set(sessionId, current.slice(0, -1));
    } else if (data.charCodeAt(0) >= 32) {
      // Printable characters
      const current = this.commandBuffer.get(sessionId) || "";
      const newBuffer = current + data;
      this.commandBuffer.set(sessionId, newBuffer);
    }

    session.pty.write(data);
    this.updateActivity(sessionId);
    return true;
  }

  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty || session.status === "dead") {
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
    const userSessions = allSessions.filter(
      (s) => s.userId === userId && s.status !== "dead"
    );

    this.fastify.log.debug(
      `Getting sessions for user ${userId}: ${userSessions.length} active of ${allSessions.length} total sessions`
    );

    return userSessions.map((s) => this.sessionToInfo(s));
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => this.sessionToInfo(s));
  }

  getReconnectHistorySize(): number {
    return this.reconnectHistorySize;
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
    const lastCommand =
      session.history.length > 0
        ? session.history[session.history.length - 1]?.command
        : undefined;

    // Check if there's a process running (simplified check)
    const isExecuting = this.isSessionExecuting(session);

    const sessionInfo = {
      id: session.id,
      name: session.name || "Unnamed Session",
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      workingDir: session.workingDir,
      connectedClients: session.connectedClients,
      outputPreview: session.outputBuffer.slice(-3).join("").slice(-100), // Last 100 chars
      lastCommand: lastCommand,
      isExecuting: isExecuting,
      deviceId: session.deviceId,
    };


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
    const recentOutput = session.outputBuffer.slice(-3).join("").trim();
    if (!recentOutput) return false;

    // Common prompt patterns that indicate shell is waiting for input
    const promptPatterns = [
      /[\$%>#]\s*$/, // Basic shell prompts
      /^[^\n]*[\$%>#]\s*$/m, // Prompt at end of line
      /\[.*\]\s*[\$%>#]\s*$/, // Prompt with brackets
      />\s*$/, // Simple > prompt
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

  private async getRealWorkingDirectory(
    sessionId: string
  ): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return null;

    try {
      const pid = session.pty.pid;

      if (process.platform === "darwin") {
        // macOS: use lsof to get the current working directory
        const { exec } = require("child_process");
        return new Promise((resolve) => {
          // Use a more specific lsof command to get just the working directory
          exec(
            `lsof -p ${pid} -a -d cwd | tail -n +2 | awk '{print $NF}'`,
            (error: any, stdout: string) => {
              if (error) {
                this.fastify.log.debug(
                  `Failed to get CWD via lsof for PID ${pid}:`,
                  error.message
                );
                resolve(null);
                return;
              }
              const lines = stdout.trim().split("\n").filter(Boolean);
              if (lines.length > 0) {
                // Use the first (and usually only) CWD entry
                const cwd = lines[0];
                this.fastify.log.debug(
                  `Detected CWD for session ${sessionId} (PID ${pid}): ${cwd}`
                );
                resolve(cwd || null);
              } else {
                this.fastify.log.debug(`No CWD found for PID ${pid}`);
                resolve(null);
              }
            }
          );
        });
      } else {
        // Linux: read from /proc/PID/cwd
        const fs = require("fs").promises;
        try {
          const cwd = await fs.readlink(`/proc/${pid}/cwd`);
          this.fastify.log.debug(
            `Detected CWD for session ${sessionId} (PID ${pid}): ${cwd}`
          );
          return cwd;
        } catch (error: any) {
          this.fastify.log.debug(
            `Failed to read /proc/${pid}/cwd:`,
            error.message
          );
          return null;
        }
      }
    } catch (error) {
      this.fastify.log.error(
        `Error getting real working directory for session ${sessionId}:`,
        error
      );
      return null;
    }
  }

  private async updateWorkingDirectoryFromProcess(
    sessionId: string
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const realCwd = await this.getRealWorkingDirectory(sessionId);
    if (realCwd && realCwd !== session.workingDir) {
      this.fastify.log.debug(
        `Real CWD detected: ${session.workingDir} -> ${realCwd}`
      );
      session.workingDir = realCwd;

      // Emit session update
      const sessionInfo = this.sessionToInfo(session);
      this.emit("session_updated", sessionInfo);
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
      // CWD check completed
    }, 1000);

    this.outputUpdateTimers.set(sessionId, timer);
  }

  private async addToOutputBuffer(
    sessionId: string,
    data: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Calculate byte size of new data
    const dataBytes = Buffer.byteLength(data, 'utf8');
    const currentBytes = this.sessionBufferBytes.get(sessionId) || 0;
    const newTotalBytes = currentBytes + dataBytes;

    // Store raw data chunks to preserve ANSI escape sequences and formatting
    session.outputBuffer.push(data);
    this.sessionBufferBytes.set(sessionId, newTotalBytes);

    // Check both chunk count and byte size limits
    let needsTrimming = false;
    
    if (session.outputBuffer.length > this.maxOutputBuffer) {
      needsTrimming = true;
    }
    
    if (newTotalBytes > this.maxOutputBufferBytes) {
      needsTrimming = true;
    }
    
    if (needsTrimming) {
      // Remove oldest chunks until we're under both limits
      let removedBytes = 0;
      while (
        (session.outputBuffer.length > this.maxOutputBuffer || 
         this.sessionBufferBytes.get(sessionId)! > this.maxOutputBufferBytes) &&
        session.outputBuffer.length > 0
      ) {
        const removedChunk = session.outputBuffer.shift();
        if (removedChunk) {
          removedBytes += Buffer.byteLength(removedChunk, 'utf8');
        }
      }
      
      // Update byte counter
      const updatedBytes = Math.max(0, (this.sessionBufferBytes.get(sessionId) || 0) - removedBytes);
      this.sessionBufferBytes.set(sessionId, updatedBytes);
      
      this.fastify.log.debug(
        `Trimmed session ${sessionId} buffer: removed ${removedBytes} bytes, ` +
        `now ${session.outputBuffer.length} chunks, ${updatedBytes} bytes`
      );
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
          this.fastify.log.debug(
            `Session ${sessionId} execution status changed: ${wasExecuting} -> ${nowExecuting}`
          );
          this.emit("session_updated", this.sessionToInfo(session));
        }
      }
    }, 100); // Small delay to let the output settle

    // Log buffer size periodically for debugging
    if (session.outputBuffer.length % 100 === 0) {
      const bytes = this.sessionBufferBytes.get(sessionId) || 0;
      const mb = (bytes / 1024 / 1024).toFixed(2);
      this.fastify.log.debug(
        `Session ${sessionId} output buffer size: ${session.outputBuffer.length} chunks, ${mb} MB`
      );
    }

    // PRIVACY: Do not save terminal output to database
    // Output is only kept in memory for active sessions
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
          const timeDiff =
            session.lastActivity.getTime() - oldActivity.getTime();

          // Emit update if execution status changed or significant time passed
          if (oldExecuting !== nowExecuting || timeDiff > 3000) {
            this.fastify.log.debug(
              `Session ${sessionId} activity update - executing: ${oldExecuting} -> ${nowExecuting}`
            );
            this.emit("session_updated", this.sessionToInfo(session));
          }
        }
      }, 100);

      // Sessions are ephemeral - no database updates
    }
  }

  private normalizePath(path: string): string {
    // Remove multiple consecutive slashes
    path = path.replace(/\/+/g, "/");

    // Split into parts and resolve . and ..
    const parts = path.split("/").filter((p) => p.length > 0);

    const resolved = [];

    for (const part of parts) {
      if (part === ".") {
        // Current directory, skip
        continue;
      } else if (part === "..") {
        // Parent directory
        if (resolved.length > 0) {
          resolved.pop();
        }
      } else {
        resolved.push(part);
      }
    }

    // Rebuild path
    const result = "/" + resolved.join("/");
    return result === "/" ? "/" : result;
  }

  private async recordCommandOnly(
    sessionId: string,
    command: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.fastify.log.debug(
      `Recording command for session ${sessionId}: ${command}`
    );

    const commandRecord: CommandHistory = {
      id: crypto.randomUUID(),
      sessionId,
      command,
      output: "",
      exitCode: null,
      timestamp: new Date(),
      duration: 0,
    };

    session.history.push(commandRecord);

    // PRIVACY: Do not save command history to database
    // Commands are only kept in memory for active sessions

    this.emit("command", sessionId, commandRecord);

    // Emit session update for command change
    const sessionInfo = this.sessionToInfo(session);
    this.emit("session_updated", sessionInfo);
  }

  // Database methods removed - sessions are now ephemeral

  private auditConnectionCounts(): void {
    let hasChanges = false;

    this.sessions.forEach((session, sessionId) => {
      // If a session has been detached for more than 5 minutes but still shows connected clients,
      // it's likely a stale count - reset it
      if (session.status === "detached" && session.connectedClients > 0) {
        const timeSinceActivity = Date.now() - session.lastActivity.getTime();
        if (timeSinceActivity > 5 * 60 * 1000) {
          // 5 minutes
          this.fastify.log.warn(
            `Resetting stale connection count for session ${sessionId}: was ${session.connectedClients}, now 0`
          );
          session.connectedClients = 0;
          hasChanges = true;

          // Emit update event
          const sessionInfo = this.sessionToInfo(session);
          this.emit("session_updated", sessionInfo);
        }
      }
    });

    if (hasChanges) {
      this.fastify.log.debug("Connection count audit completed with changes");
    }
  }

  private async cleanupDeadSessions(): Promise<void> {
    const now = new Date();
    const deadSessionThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const detachedSessionThreshold = 2 * 60 * 60 * 1000; // 2 hours for detached sessions

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      // Clean up dead sessions after 24 hours
      if (session.status === "dead" && timeSinceActivity > deadSessionThreshold) {
        this.cleanupSession(sessionId, session);
        continue;
      }
      
      // Clean up detached sessions after 2 hours of inactivity
      if (
        session.status === "detached" && 
        session.connectedClients === 0 && 
        timeSinceActivity > detachedSessionThreshold
      ) {
        this.fastify.log.debug(
          `Cleaning up detached session ${sessionId} after ${Math.round(timeSinceActivity / 1000 / 60)} minutes of inactivity`
        );
        this.cleanupSession(sessionId, session);
      }
    }

    // Clean up orphaned device mappings
    for (const [deviceKey, sessionId] of this.userDeviceSessions.entries()) {
      if (!this.sessions.has(sessionId)) {
        this.userDeviceSessions.delete(deviceKey);
        this.fastify.log.debug(`Cleaned up orphaned device mapping: ${deviceKey}`);
      }
    }
  }

  /**
   * Clean up a session and all associated resources
   */
  private cleanupSession(sessionId: string, session: TerminalSession): void {
    // Kill PTY if still alive
    if (session.pty) {
      try {
        session.pty.kill();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);
    this.commandBuffer.delete(sessionId);
    this.sessionSequenceNumbers.delete(sessionId);
    this.sessionBufferBytes.delete(sessionId);

    // Clear any pending timers
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

    // Remove from device mapping if applicable
    if (session.deviceId) {
      const deviceKey = `${session.userId}-${session.deviceId}`;
      if (this.userDeviceSessions.get(deviceKey) === sessionId) {
        this.userDeviceSessions.delete(deviceKey);
      }
    }

    this.fastify.log.debug(`Cleaned up session: ${sessionId} (status: ${session.status})`);
    
    // Emit deletion event
    this.emit("session_deleted", sessionId);
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.fastify.log.info("Shutting down SessionManager...");

    // Update all sessions as detached
    for (const session of this.sessions.values()) {
      if (session.status === "active") {
        session.status = "detached";
        session.connectedClients = 0;
        // Sessions are ephemeral - no database updates
      }
    }
  }
}
