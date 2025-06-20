# Claude Code Web 架构设计

## 系统架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Web Browser                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐ │
│  │   Terminal UI       │  │    Code Editor (IDE)     │ │
│  │   (xterm.js)        │  │    (code-server)         │ │
│  └──────────┬──────────┘  └────────────┬─────────────┘ │
└─────────────┼───────────────────────────┼───────────────┘
              │ WebSocket                  │ HTTP/WS
              ▼                            ▼
┌─────────────────────────────────────────────────────────┐
│                   API Gateway (Nginx)                    │
│                 ┌─────────────────────┐                 │
│                 │   Auth & Routing    │                 │
│                 └─────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
              │                            │
              ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│    Terminal Service      │  │     IDE Service          │
│  ┌────────────────────┐  │  │  ┌────────────────────┐  │
│  │   WebSocket API    │  │  │  │   code-server      │  │
│  ├────────────────────┤  │  │  └────────────────────┘  │
│  │   Session Manager  │  │  └──────────────────────────┘
│  ├────────────────────┤  │
│  │   PTY Controller   │  │
│  └────────────────────┘  │
└──────────────────────────┘
              │
              ▼
┌──────────────────────────┐
│   Claude Code Process    │
│  ┌────────────────────┐  │
│  │   Shell (bash/zsh) │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

## 核心组件选择

### 1. 终端服务方案

**推荐方案**: 自定义 Node.js 服务
- **前端**: xterm.js
- **后端**: Express + Socket.IO + node-pty
- **优势**:
  - 完全控制终端行为
  - 易于集成Claude Code特定功能
  - 支持会话管理和历史记录

**备选方案**: ttyd
- **优势**: 开箱即用，配置简单
- **劣势**: 定制化困难

### 2. IDE集成方案

**推荐方案**: code-server
- **部署**: Docker容器独立运行
- **集成**: iframe嵌入或新标签页打开
- **同步**: 通过文件系统共享工作目录

### 3. 技术栈

**后端**:
- Node.js + TypeScript
- Express.js (HTTP服务器)
- Socket.IO (WebSocket通信)
- node-pty (PTY控制)
- PM2 (进程管理)

**前端**:
- React + TypeScript
- xterm.js (终端UI)
- Material-UI (界面组件)
- Socket.IO Client

**基础设施**:
- Docker + Docker Compose
- Nginx (反向代理)
- Redis (会话存储)
- PostgreSQL (历史记录)

## 功能模块设计

### 1. 终端管理模块
```typescript
interface TerminalSession {
  id: string;
  userId: string;
  pty: IPty;
  history: string[];
  createdAt: Date;
  lastActivity: Date;
}
```

### 2. Claude Code集成
```typescript
interface ClaudeCodeManager {
  start(): Promise<ChildProcess>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  sendCommand(command: string): Promise<void>;
  onOutput(callback: (data: string) => void): void;
}
```

### 3. 文件同步模块
```typescript
interface FileSyncService {
  watchDirectory(path: string): void;
  onFileChange(callback: (event: FileChangeEvent) => void): void;
  syncToIDE(): Promise<void>;
}
```

## 安全设计

1. **认证授权**
   - JWT Token认证
   - 基于角色的访问控制(RBAC)

2. **网络安全**
   - HTTPS/WSS加密传输
   - CORS策略配置

3. **进程隔离**
   - Docker容器隔离
   - 资源限制(CPU/内存)

4. **审计日志**
   - 所有命令记录
   - 操作审计追踪

## 部署架构

### Docker Compose配置
```yaml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"

  terminal-service:
    build: ./backend
    environment:
      - NODE_ENV=production

  code-server:
    image: codercom/code-server:latest
    environment:
      - PASSWORD=secure-password

  redis:
    image: redis:alpine

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=claude_web
```

## 开发路线图

1. **Phase 1**: 基础终端功能
   - 实现WebSocket终端连接
   - Claude Code进程管理
   - 基本的历史记录

2. **Phase 2**: IDE集成
   - 集成code-server
   - 文件同步机制
   - 统一界面

3. **Phase 3**: 高级功能
   - 多用户支持
   - 会话持久化
   - 协作功能

4. **Phase 4**: 生产部署
   - 安全加固
   - 性能优化
   - 监控告警