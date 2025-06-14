export interface WebSocketMessage {
  type: 'terminal_data' | 'terminal_clear' | 'command_history' | 'claude_status' | 'claude_output' | 'session_info' | 'error' | 'terminal_exit' | 'session_list' | 'session_updated' | 'session_deleted';
  data: any;
  timestamp: Date;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;

  connect(sessionId: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected to the same session, don't create a new connection
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionId === sessionId) {
        console.log('Already connected to session:', sessionId);
        resolve();
        return;
      }

      // Disconnect any existing connection
      if (this.ws) {
        console.log('Disconnecting existing WebSocket connection');
        this.disconnect();
      }

      this.sessionId = sessionId;

      // Build WebSocket URL with auth token as query parameter
      const wsUrl = `ws://localhost:12021/ws/terminal/${sessionId}?token=${encodeURIComponent(token)}`;
      
      try {
        console.log('Creating new WebSocket connection to:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.handleReconnect(token);
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      // Remove event listeners to prevent unwanted reconnection
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.sessionId = null;
    this.messageHandlers.clear();
  }

  sendTerminalInput(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send terminal input');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'terminal_input',
      data,
    }));
  }

  sendTerminalResize(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send resize');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'terminal_resize',
      cols,
      rows,
    }));
  }

  requestHistory(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, deferring history request');
      // Retry after a delay
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.requestHistory();
        }
      }, 1000);
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'get_history',
    }));
  }

  startClaude(config?: {
    workingDir?: string;
    environment?: Record<string, string>;
    args?: string[];
    autoRestart?: boolean;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'claude_start',
      ...config,
    }));
  }

  stopClaude(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'claude_stop',
    }));
  }

  restartClaude(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'claude_restart',
    }));
  }

  onMessage(type: string, handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }

    // Also call generic handler
    const allHandler = this.messageHandlers.get('*');
    if (allHandler) {
      allHandler(message);
    }
  }

  private handleReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId, token).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// Session List WebSocket Service
export class SessionListWebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;
  private token: string | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected, don't create a new connection
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('Session list WebSocket already connected');
        resolve();
        return;
      }

      // Disconnect any existing connection
      if (this.ws) {
        console.log('Disconnecting existing session list WebSocket connection');
        this.disconnect();
      }

      this.token = token;

      // Build WebSocket URL for session list
      const wsUrl = `ws://localhost:12021/ws/sessions?token=${encodeURIComponent(token)}`;
      
      try {
        console.log('Creating session list WebSocket connection to:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('Session list WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('Session list WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('Failed to parse session list WebSocket message:', e);
          }
        };

        this.ws.onclose = (event) => {
          console.log('Session list WebSocket closed:', event.code, event.reason);
          this.handleReconnect();
        };

      } catch (error) {
        console.error('Failed to create session list WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      // Remove event listeners to prevent unwanted reconnection
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.token = null;
    this.messageHandlers.clear();
  }

  requestSessions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Session list WebSocket not connected, cannot request sessions');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'get_sessions',
    }));
  }

  onMessage(type: string, handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }

    // Also call generic handler
    const allHandler = this.messageHandlers.get('*');
    if (allHandler) {
      allHandler(message);
    }
  }

  private handleReconnect(): void {
    if (!this.token) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max session list reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    console.log(`Reconnecting session list WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.token) {
        this.connect(this.token).catch((error) => {
          console.error('Session list reconnection failed:', error);
        });
      }
    }, delay);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instances
export const wsService = new WebSocketService();
export const sessionListWsService = new SessionListWebSocketService();