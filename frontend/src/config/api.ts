/**
 * API 配置统一管理
 */

// 获取 API Base URL
export const getApiBaseUrl = (): string => {
  if (!process.env.REACT_APP_API_URL) {
    return `${window.location.protocol}//${window.location.host}`;
  }

  if (process.env.REACT_APP_API_SAME_HOST !== "true") {
    return process.env.REACT_APP_API_URL;
  }

  const apiUrl = new URL(process.env.REACT_APP_API_URL);
  const hrefUrl = new URL(window.location.href);

  return process.env.REACT_APP_API_URL.replace(
    apiUrl.hostname,
    hrefUrl.hostname
  );
};

// 获取 WebSocket URL
export const getWebSocketUrl = (): string => {
  const baseUrl = getApiBaseUrl();

  // 生产环境
  const protocol = baseUrl.startsWith("https:") ? "wss:" : "ws:";
  return baseUrl.replace(/^https?:/, protocol);
};

// 构建完整的 API URL
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (baseUrl) {
    return `${baseUrl}/api${cleanEndpoint}`;
  }

  return `/api${cleanEndpoint}`;
};

// API 端点常量
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
  },

  // 会话相关
  SESSIONS: {
    LIST: "/sessions",
    CREATE: "/sessions",
    ATTACH: "/sessions/attach",
    DELETE: (sessionId: string) => `/sessions/${sessionId}`,
    RENAME: (sessionId: string) => `/sessions/${sessionId}`,
    OUTPUT: (sessionId: string) => `/sessions/${sessionId}/output`,
  },

  // SSH 相关
  SSH: {
    INFO: "/ssh-info",
    KEYS: {
      GET: "/ssh-keys",
      ADD: "/ssh-keys",
      DELETE: (index: number) => `/ssh-keys/${index}`,
    },
  },

  // 其他
  HEALTH: "/health",
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
    delete: (index: number) =>
      buildApiUrl(API_ENDPOINTS.SSH.KEYS.DELETE(index)),
  },

  // SSH Info convenience method
  ssh: {
    info: () => buildApiUrl(API_ENDPOINTS.SSH.INFO),
  },
};
