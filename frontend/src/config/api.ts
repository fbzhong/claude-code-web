/**
 * API 配置统一管理
 */

// 获取 API Base URL
export const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 开发环境默认值
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:12021';
  }
  
  // 生产环境使用相对路径（假设前后端在同一域名下）
  return '';
};

// 获取 WebSocket URL
export const getWebSocketUrl = (): string => {
  // 优先使用环境变量
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  
  const apiUrl = getApiBaseUrl();
  
  // 开发环境
  if (process.env.NODE_ENV === 'development') {
    return apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  }
  
  // 生产环境
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return apiUrl ? apiUrl.replace(/^https?:/, protocol) : `${protocol}//${window.location.host}`;
};

// 构建完整的 API URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (baseUrl) {
    return `${baseUrl}/api${cleanEndpoint}`;
  }
  
  return `/api${cleanEndpoint}`;
};

// API 端点常量
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
  },
  
  // 会话相关
  SESSIONS: {
    LIST: '/sessions',
    CREATE: '/sessions',
    ATTACH: '/sessions/attach',
    DELETE: (sessionId: string) => `/sessions/${sessionId}`,
    RENAME: (sessionId: string) => `/sessions/${sessionId}`,
    OUTPUT: (sessionId: string) => `/sessions/${sessionId}/output`,
  },
  
  // SSH 相关
  SSH: {
    INFO: '/ssh-info',
    KEYS: {
      GET: '/ssh-keys',
      ADD: '/ssh-keys',
      DELETE: (index: number) => `/ssh-keys/${index}`,
    },
  },
  
  // 其他
  HEALTH: '/health',
} as const;

// 导出便捷方法
export const api = {
  url: buildApiUrl,
  endpoints: API_ENDPOINTS,
  baseUrl: getApiBaseUrl,
  wsUrl: getWebSocketUrl,
  
  // SSH Keys convenience methods
  sshKeys: {
    get: () => buildApiUrl(API_ENDPOINTS.SSH.KEYS.GET),
    add: () => buildApiUrl(API_ENDPOINTS.SSH.KEYS.ADD),
    delete: (index: number) => buildApiUrl(API_ENDPOINTS.SSH.KEYS.DELETE(index)),
  },
  
  // SSH Info convenience method
  ssh: {
    info: () => buildApiUrl(API_ENDPOINTS.SSH.INFO),
  },
};