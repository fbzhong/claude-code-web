# ttyd 集成方案

## 架构设计

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│   Nginx      │────▶│   Backend   │
│  (xterm.js) │     │ (Proxy)      │     │   (API)     │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │     ttyd     │
                    │  (Terminal)  │
                    └──────────────┘
```

## 集成步骤

### 1. ttyd 作为独立服务运行
```bash
# 启动 ttyd，绑定到内部端口
ttyd -p 7681 -i lo -c testuser:password123 \
     -t enableSixel=true \
     -t fontSize=14 \
     bash
```

### 2. Nginx 反向代理配置
```nginx
location /terminal/ws {
    proxy_pass http://localhost:7681/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 3. 后端 API 管理 ttyd 进程
```typescript
class TtydManager {
  async startSession(userId: string, sessionId: string) {
    const port = await this.findAvailablePort();
    const process = spawn('ttyd', [
      '-p', port.toString(),
      '-i', 'lo',
      '--once',  // 单个连接后退出
      '-t', `titleFixed=Claude Web - ${sessionId}`,
      'bash', '-c', `claude code`
    ]);
    
    this.sessions.set(sessionId, { port, process, userId });
    return port;
  }
}
```

### 4. 前端连接改造
```typescript
// 从后端获取 ttyd 端口
const { port } = await api.createTerminalSession();

// 连接到 ttyd WebSocket
const ws = new WebSocket(`ws://localhost:${port}/ws`);
```

## 扩展功能

### 1. 命令拦截和记录
使用 `script` 命令记录会话：
```bash
ttyd bash -c "script -f /tmp/session_${SESSION_ID}.log"
```

### 2. Claude Code 集成
```bash
# 启动时自动运行 Claude Code
ttyd bash -c "claude code && exec bash"
```

### 3. 会话持久化
结合 `tmux` 实现会话保持：
```bash
ttyd tmux new-session -A -s "claude_${SESSION_ID}"
```

## 优势总结

1. **快速实现**：1-2 天即可完成基础集成
2. **功能完整**：支持所有终端特性
3. **易于维护**：ttyd 持续更新，bug 修复及时
4. **平滑过渡**：后期可逐步替换为自建方案

## 风险控制

1. **安全性**：ttyd 运行在内部网络，通过后端 API 控制访问
2. **资源管理**：限制每用户会话数，自动清理超时会话
3. **监控**：记录所有命令，实现审计功能