import { api } from '../config/api';
import { getDeviceId } from '../utils/deviceId';

const getWsInfo: () => {
  host: string;
  protocol: string;
} = () => {
  const wsUrl = api.wsUrl();
  const url = new URL(wsUrl);
  
  return {
    host: url.host,
    protocol: url.protocol,
  };
};

export interface WebSocketMessage {
  type:
    | "terminal_data"
    | "terminal_clear"
    | "command_history"
    | "claude_status"
    | "claude_output"
    | "session_info"
    | "error"
    | "terminal_exit"
    | "session_list"
    | "session_updated"
    | "session_deleted"
    | "ping"
    | "pong";
  data: any;
  timestamp: Date;
}

export interface ConnectionOptions {
  deviceId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnecting?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private static instanceId = 0;
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> =
    new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private maxReconnectTime = 15 * 60 * 1000; // 15 minutes
  private baseDelay = 2000; // 2 seconds base delay
  private maxDelay = 30000; // 30 seconds max delay
  private jitterFactor = 0.3; // 30% jitter
  private reconnectTimeout: any = null;
  private pendingResize: { cols: number; rows: number } | null = null;
  private disconnectTime: number | null = null;
  private connectionOptions: ConnectionOptions | null = null;
  private pingInterval: any = null;
  private pongTimeout: any = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private instanceId: number;
  private networkOnlineHandler: (() => void) | null = null;
  private networkOfflineHandler: (() => void) | null = null;
  private isNetworkOnline = true; // 假设初始网络是在线的

  constructor() {
    this.instanceId = ++WebSocketService.instanceId;
    console.log(`[WebSocketService] Instance created #${this.instanceId}`);
    this.setupNetworkStatusMonitoring();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(sessionId: string, token: string, options?: ConnectionOptions): Promise<void> {
    return new Promise(async (resolve, reject) => {
      console.log(`[WebSocketService #${this.instanceId}] connect called for session:`, sessionId);
      
      // Only update connectionOptions if new options are provided
      if (options) {
        this.connectionOptions = options;
      }
      
      // Ensure we have connection options
      if (!this.connectionOptions) {
        this.connectionOptions = {};
      }
      
      // Get device ID if not provided
      if (!this.connectionOptions.deviceId) {
        this.connectionOptions.deviceId = await getDeviceId();
      }
      
      // If already connected to the same session with a healthy connection, reuse it
      if (
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        this.sessionId === sessionId
      ) {
        console.log(
          `[WebSocketService #${this.instanceId}] Already connected to session:`,
          sessionId,
          "reusing connection"
        );
        resolve();
        return;
      }

      // Disconnect any existing connection if switching sessions or connection is unhealthy
      if (this.ws) {
        console.log(
          "Disconnecting existing WebSocket connection for session switch or reconnection"
        );
        this.disconnect();
      }

      this.sessionId = sessionId;
      this.disconnectTime = null;
      this.reconnectAttempts = 0;

      // Build WebSocket URL with auth token and device ID as query parameters
      const { host, protocol } = getWsInfo();
      const wsUrl = `${protocol}//${host}/ws/terminal/${sessionId}?token=${encodeURIComponent(
        token
      )}&deviceId=${encodeURIComponent(this.connectionOptions.deviceId)}`;

      try {
        console.log("Creating new WebSocket connection to:", wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log("[WebSocket] onopen fired, readyState:", this.ws?.readyState);
          this.reconnectAttempts = 0;
          this.disconnectTime = null;
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Send any pending resize message
          if (this.pendingResize) {
            console.log("[WebSocket] Sending pending resize:", this.pendingResize);
            this.ws!.send(
              JSON.stringify({
                type: "terminal_resize",
                cols: this.pendingResize.cols,
                rows: this.pendingResize.rows,
              })
            );
            this.pendingResize = null;
          }
          
          // Notify connection success
          console.log("[WebSocket] Emitting 'connect' event");
          this.connectionOptions?.onConnect?.();
          this.emit('connect');
          
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
          }
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          this.stopHeartbeat();
          
          // Record disconnect time if not already recorded
          if (!this.disconnectTime) {
            this.disconnectTime = Date.now();
          }
          
          // Notify disconnection
          this.connectionOptions?.onDisconnect?.();
          this.emit('disconnect');
          
          this.handleReconnect(token);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.removeNetworkStatusMonitoring();
    
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

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.sessionId = null;
    this.disconnectTime = null;
    this.messageHandlers.clear();
    // Don't clear connectionOptions - we need them for reconnection
    // this.connectionOptions = null;
  }

  sendTerminalInput(data: string): void {
    console.log('[WebSocket] sendTerminalInput called with:', {
      data: data.replace(/\n/g, '\\n').replace(/\r/g, '\\r'),
      wsExists: !!this.ws,
      wsState: this.ws?.readyState,
      wsStateText: this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NO_WS',
      sessionId: this.sessionId,
      instanceId: this.instanceId
    });
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot send terminal input", {
        wsExists: !!this.ws,
        wsState: this.ws?.readyState,
        wsStateText: this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NO_WS',
        sessionId: this.sessionId
      });
      return;
    }

    const message = {
      type: "terminal_input",
      data,
    };
    
    console.log('[WebSocket] Sending message:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendTerminalResize(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, caching resize for later:", { cols, rows });
      // Cache the resize to send when connection is established
      this.pendingResize = { cols, rows };
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "terminal_resize",
        cols,
        rows,
      })
    );
  }

  requestHistory(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, deferring history request");
      // Retry after a delay
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.requestHistory();
        }
      }, 1000);
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "get_history",
      })
    );
  }

  startClaude(config?: {
    workingDir?: string;
    environment?: Record<string, string>;
    args?: string[];
    autoRestart?: boolean;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    this.ws.send(
      JSON.stringify({
        type: "claude_start",
        ...config,
      })
    );
  }

  stopClaude(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    this.ws.send(
      JSON.stringify({
        type: "claude_stop",
      })
    );
  }

  restartClaude(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    this.ws.send(
      JSON.stringify({
        type: "claude_restart",
      })
    );
  }

  onMessage(type: string, handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  // Event emitter methods
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('[WebSocket] handleMessage:', {
      type: message.type,
      dataLength: message.data ? JSON.stringify(message.data).length : 0,
      timestamp: new Date().toISOString()
    });
    
    // Handle ping/pong
    if (message.type === 'ping') {
      this.ws?.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    
    if (message.type === 'pong') {
      // Reset pong timeout
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      return;
    }
    
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      console.log(`[WebSocket] Calling handler for ${message.type}`);
      handler(message);
    } else {
      console.warn(`[WebSocket] No handler registered for message type: ${message.type}`);
    }

    // Also call generic handler
    const allHandler = this.messageHandlers.get("*");
    if (allHandler) {
      allHandler(message);
    }
  }

  private handleReconnect(token: string): void {
    // Don't reconnect if manually disconnected
    if (!this.sessionId) {
      console.log("Session manually disconnected, not reconnecting");
      return;
    }
    
    // Check if we've exceeded the max reconnection time
    if (this.disconnectTime) {
      const timeSinceDisconnect = Date.now() - this.disconnectTime;
      if (timeSinceDisconnect > this.maxReconnectTime) {
        console.error("Max reconnection time exceeded, stopping auto-reconnect");
        this.connectionOptions?.onReconnectFailed?.();
        this.emit('reconnectFailed');
        return;
      }
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.connectionOptions?.onReconnectFailed?.();
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    
    // 更平滑的退避算法：线性增长 + 随机抖动
    const linearDelay = this.baseDelay + (this.reconnectAttempts - 1) * 3000; // 每次增加3秒
    const cappedDelay = Math.min(linearDelay, this.maxDelay);
    
    // 添加随机抖动，避免多个连接同时重连
    const jitter = cappedDelay * this.jitterFactor * (Math.random() - 0.5);
    const delay = Math.max(1000, cappedDelay + jitter); // 最小1秒延迟

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );
    
    // Notify reconnecting
    this.connectionOptions?.onReconnecting?.(this.reconnectAttempts);
    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId, token, this.connectionOptions || undefined).catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        
        // Expect pong within 5 seconds
        this.pongTimeout = setTimeout(() => {
          console.error("Pong timeout, connection seems dead");
          this.ws?.close();
        }, 5000);
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
  
  private setupNetworkStatusMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // 初始化网络状态
    this.isNetworkOnline = navigator.onLine;
    console.log('[WebSocket] Initial network status:', this.isNetworkOnline ? 'online' : 'offline');
    
    // 网络恢复事件处理
    this.networkOnlineHandler = () => {
      console.log('[WebSocket] Network status changed to online');
      this.isNetworkOnline = true;
      if (this.shouldAttemptReconnect()) {
        this.attemptImmediateReconnect();
      }
    };
    
    // 网络断开事件处理
    this.networkOfflineHandler = () => {
      console.log('[WebSocket] Network status changed to offline, pausing reconnection attempts');
      this.isNetworkOnline = false;
      // 清除当前的重连定时器
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        console.log('[WebSocket] Cancelled pending reconnection due to network offline');
      }
    };
    
    // 注册事件监听器
    window.addEventListener('online', this.networkOnlineHandler);
    window.addEventListener('offline', this.networkOfflineHandler);
  }
  
  private removeNetworkStatusMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    if (this.networkOnlineHandler) {
      window.removeEventListener('online', this.networkOnlineHandler);
      this.networkOnlineHandler = null;
    }
    
    if (this.networkOfflineHandler) {
      window.removeEventListener('offline', this.networkOfflineHandler);
      this.networkOfflineHandler = null;
    }
  }
  
  private shouldAttemptReconnect(): boolean {
    return (
      this.isNetworkOnline && // 网络在线
      !!this.sessionId && // 有会话需要重连
      (!this.ws || this.ws.readyState !== WebSocket.OPEN) && // 当前未连接
      this.reconnectAttempts < this.maxReconnectAttempts && // 未超过最大重连次数
      (!this.disconnectTime || Date.now() - this.disconnectTime < this.maxReconnectTime) // 未超过最大重连时间
    );
  }
  
  private attemptImmediateReconnect(): void {
    if (!this.sessionId || !this.connectionOptions) return;
    
    // 清除当前的重连定时器
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // 获取当前 token（从 localStorage 或其他来源）
    const token = this.getCurrentToken();
    if (token) {
      console.log('[WebSocket] Attempting immediate reconnect due to network recovery');
      this.connect(this.sessionId, token, this.connectionOptions);
    }
  }
  
  private getCurrentToken(): string | null {
    // 从 localStorage 获取 token
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('auth_token');
    }
    return null;
  }
  
  getConnectionState(): 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'failed' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        if (this.reconnectTimeout) return 'reconnecting';
        if (this.disconnectTime && Date.now() - this.disconnectTime > this.maxReconnectTime) {
          return 'failed';
        }
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }
  
  canManualReconnect(): boolean {
    return this.getConnectionState() === 'failed' && !!this.sessionId;
  }
  
  manualReconnect(token: string): void {
    if (!this.canManualReconnect()) return;
    
    // Reset state for manual reconnect
    this.reconnectAttempts = 0;
    this.disconnectTime = null;
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Attempt to connect
    this.connect(this.sessionId!, token, this.connectionOptions || undefined);
  }
}

// Global WebSocket tracker for debugging
(window as any).__websockets = (window as any).__websockets || [];

// Session List WebSocket Service
export class SessionListWebSocketService {
  private static instance: SessionListWebSocketService | null = null;
  private static instanceCount = 0;
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> =
    new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private maxReconnectTime = 15 * 60 * 1000; // 15 minutes
  private baseDelay = 2000; // 2 seconds base delay
  private maxDelay = 30000; // 30 seconds max delay
  private jitterFactor = 0.3; // 30% jitter
  private reconnectTimeout: any = null;
  private token: string | null = null;
  private disconnectTime: number | null = null;
  private pingInterval: any = null;
  private pongTimeout: any = null;
  private instanceId: number;
  private networkOnlineHandler: (() => void) | null = null;
  private networkOfflineHandler: (() => void) | null = null;
  private isNetworkOnline = true; // 假设初始网络是在线的

  constructor() {
    this.instanceId = ++SessionListWebSocketService.instanceCount;
    console.log(`[SessionListWS] New instance created #${this.instanceId}`);
    this.setupNetworkStatusMonitoring();
  }

  static getInstance(): SessionListWebSocketService {
    if (!SessionListWebSocketService.instance) {
      SessionListWebSocketService.instance = new SessionListWebSocketService();
    }
    return SessionListWebSocketService.instance;
  }

  connect(token: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      console.log('[SessionListWS] Connect called, current state:', {
        wsExists: !!this.ws,
        wsState: this.ws?.readyState,
        wsStateText: this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NO_WS'
      });
      
      // If already connected or connecting, don't create a new connection
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        console.log("[SessionListWS] Already connected or connecting, state:", this.ws.readyState);
        
        // If connecting, wait for it to complete
        if (this.ws.readyState === WebSocket.CONNECTING) {
          const checkConnection = () => {
            if (!this.ws) {
              reject(new Error("WebSocket was destroyed while connecting"));
              return;
            }
            
            if (this.ws.readyState === WebSocket.OPEN) {
              console.log("[SessionListWS] Connection completed while waiting");
              resolve();
            } else if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
              reject(new Error("WebSocket connection failed"));
            } else {
              // Still connecting, check again
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        } else {
          resolve();
        }
        return;
      }

      // Disconnect any existing connection
      if (this.ws) {
        console.log("Disconnecting existing session list WebSocket connection");
        this.disconnect();
      }

      this.token = token;
      this.disconnectTime = null;
      this.reconnectAttempts = 0;

      // Get device ID
      const deviceId = await getDeviceId();

      // Build WebSocket URL for session list
      const { host, protocol } = getWsInfo();
      const wsUrl = `${protocol}//${host}/ws/sessions?token=${encodeURIComponent(
        token
      )}&deviceId=${encodeURIComponent(deviceId)}`;

      try {
        console.log("[SessionListWS] Creating new WebSocket connection to:", wsUrl);
        this.ws = new WebSocket(wsUrl);
        console.log("[SessionListWS] WebSocket created, state:", this.ws.readyState);
        
        // Track WebSocket globally for debugging
        (window as any).__websockets.push({
          url: wsUrl,
          type: 'session_list',
          ws: this.ws,
          createdAt: new Date().toISOString(),
          instanceId: this.instanceId
        });

        this.ws.onopen = () => {
          console.log("Session list WebSocket connected");
          this.reconnectAttempts = 0;
          this.disconnectTime = null;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error("Session list WebSocket error:", error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(
              "SessionListWebSocket received message:",
              message.type,
              message.data
            );
            this.handleMessage(message);
          } catch (e) {
            console.error("Failed to parse session list WebSocket message:", e);
          }
        };

        this.ws.onclose = (event) => {
          console.log(
            "Session list WebSocket closed:",
            event.code,
            event.reason
          );
          this.stopHeartbeat();
          
          if (!this.disconnectTime) {
            this.disconnectTime = Date.now();
          }
          
          this.handleReconnect();
        };
      } catch (error) {
        console.error("Failed to create session list WebSocket:", error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    console.log('[SessionListWS] Disconnect called');
    this.stopHeartbeat();
    this.removeNetworkStatusMonitoring();
    
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

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        console.log('[SessionListWS] Closing WebSocket, current state:', this.ws.readyState);
        this.ws.close(1000, 'Manual disconnect');
      }
      this.ws = null;
    }
    this.token = null;
    this.disconnectTime = null;
    this.reconnectAttempts = 0; // Reset reconnect attempts
    this.messageHandlers.clear();
  }

  requestSessions(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "Session list WebSocket not connected, cannot request sessions"
      );
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "get_sessions",
      })
    );
  }

  onMessage(type: string, handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('[WebSocket] handleMessage:', {
      type: message.type,
      dataLength: message.data ? JSON.stringify(message.data).length : 0,
      timestamp: new Date().toISOString()
    });
    
    // Handle ping/pong
    if (message.type === 'ping') {
      this.ws?.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    
    if (message.type === 'pong') {
      // Reset pong timeout
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      return;
    }
    
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      console.log(`[WebSocket] Calling handler for ${message.type}`);
      handler(message);
    } else {
      console.warn(`[WebSocket] No handler registered for message type: ${message.type}`);
    }

    // Also call generic handler
    const allHandler = this.messageHandlers.get("*");
    if (allHandler) {
      allHandler(message);
    }
  }

  private handleReconnect(): void {
    if (!this.token) return;
    
    // 检查网络状态，如果网络断开则不重连
    if (!this.isNetworkOnline) {
      console.log("Network is offline, skipping session list reconnection attempt");
      return;
    }
    
    // Check if we've exceeded the max reconnection time
    if (this.disconnectTime) {
      const timeSinceDisconnect = Date.now() - this.disconnectTime;
      if (timeSinceDisconnect > this.maxReconnectTime) {
        console.error("Max session list reconnection time exceeded");
        return;
      }
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max session list reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    
    // 更平滑的退避算法：线性增长 + 随机抖动
    const linearDelay = this.baseDelay + (this.reconnectAttempts - 1) * 3000; // 每次增加3秒
    const cappedDelay = Math.min(linearDelay, this.maxDelay);
    
    // 添加随机抖动，避免多个连接同时重连
    const jitter = cappedDelay * this.jitterFactor * (Math.random() - 0.5);
    const delay = Math.max(1000, cappedDelay + jitter); // 最小1秒延迟

    console.log(
      `Reconnecting session list WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.token) {
        this.connect(this.token).catch((error) => {
          console.error("Session list reconnection failed:", error);
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        
        // Expect pong within 5 seconds
        this.pongTimeout = setTimeout(() => {
          console.error("Session list pong timeout, connection seems dead");
          this.ws?.close();
        }, 5000);
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  private setupNetworkStatusMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // 初始化网络状态
    this.isNetworkOnline = navigator.onLine;
    console.log('[SessionListWS] Initial network status:', this.isNetworkOnline ? 'online' : 'offline');
    
    // 网络恢复事件处理
    this.networkOnlineHandler = () => {
      console.log('[SessionListWS] Network status changed to online');
      this.isNetworkOnline = true;
      if (this.shouldAttemptReconnect()) {
        this.attemptImmediateReconnect();
      }
    };
    
    // 网络断开事件处理
    this.networkOfflineHandler = () => {
      console.log('[SessionListWS] Network status changed to offline, pausing reconnection attempts');
      this.isNetworkOnline = false;
      // 清除当前的重连定时器
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        console.log('[SessionListWS] Cancelled pending reconnection due to network offline');
      }
    };
    
    // 注册事件监听器
    window.addEventListener('online', this.networkOnlineHandler);
    window.addEventListener('offline', this.networkOfflineHandler);
  }
  
  private removeNetworkStatusMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    if (this.networkOnlineHandler) {
      window.removeEventListener('online', this.networkOnlineHandler);
      this.networkOnlineHandler = null;
    }
    
    if (this.networkOfflineHandler) {
      window.removeEventListener('offline', this.networkOfflineHandler);
      this.networkOfflineHandler = null;
    }
  }
  
  private shouldAttemptReconnect(): boolean {
    return (
      this.isNetworkOnline && // 网络在线
      !!this.token && // 有 token 需要重连
      (!this.ws || this.ws.readyState !== WebSocket.OPEN) && // 当前未连接
      this.reconnectAttempts < this.maxReconnectAttempts && // 未超过最大重连次数
      (!this.disconnectTime || Date.now() - this.disconnectTime < this.maxReconnectTime) // 未超过最大重连时间
    );
  }
  
  private attemptImmediateReconnect(): void {
    if (!this.token) return;
    
    // 清除当前的重连定时器
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    console.log('[SessionListWS] Attempting immediate reconnect due to network recovery');
    this.connect(this.token);
  }
}

// Singleton instances
export const wsService = WebSocketService.getInstance();
export const sessionListWsService = SessionListWebSocketService.getInstance();