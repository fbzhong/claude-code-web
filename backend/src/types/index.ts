export interface TerminalSession {
  id: string;
  userId: string;
  pty?: any;
  history: CommandHistory[];
  createdAt: Date;
  lastActivity: Date;
  workingDir: string;
  environment: Record<string, string>;
}

export interface CommandHistory {
  id: string;
  sessionId: string;
  command: string;
  output: string;
  exitCode: number | null;
  timestamp: Date;
  duration: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastLogin?: Date;
}

export interface ClaudeCodeProcess {
  id: string;
  sessionId: string;
  pid: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startedAt: Date;
  config: ClaudeCodeConfig;
}

export interface ClaudeCodeConfig {
  workingDir: string;
  environment: Record<string, string>;
  args: string[];
  autoRestart: boolean;
}

export interface WebSocketMessage {
  type: 'terminal_data' | 'command_history' | 'claude_status' | 'session_info';
  sessionId: string;
  data: any;
  timestamp: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}