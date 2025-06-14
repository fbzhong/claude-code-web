# ttyd vs 自建方案对比

## 方案一：基于 ttyd 修改

### 优点
1. **快速启动**：几分钟就能运行起来
2. **稳定可靠**：经过生产验证，bug少
3. **功能完整**：支持多种终端特性、文件传输等
4. **轻量级**：C语言编写，资源占用少

### 缺点
1. **定制困难**：C语言代码，修改门槛高
2. **集成限制**：难以深度集成Claude Code特定功能
3. **扩展性差**：添加会话管理、历史记录等功能复杂

### 改造方案
```bash
# 1. Fork ttyd 源码
# 2. 修改前端添加历史记录UI
# 3. 修改后端支持命令拦截和记录
# 4. 通过插件机制集成其他功能
```

## 方案二：使用核心组件自建

### 优点
1. **完全控制**：可以深度定制所有功能
2. **技术栈统一**：Node.js/TypeScript，易于维护
3. **功能灵活**：轻松添加Claude Code特定功能
4. **扩展性强**：方便集成认证、权限、监控等

### 缺点
1. **开发周期长**：需要从零实现基础功能
2. **稳定性风险**：需要处理各种边界情况
3. **维护成本**：需要持续修复bug和优化

### 技术架构
```typescript
// 后端核心
- Express + Socket.IO
- node-pty (终端控制)
- 自定义会话管理
- Claude Code进程管理

// 前端
- React + xterm.js
- 自定义UI组件
- 历史记录面板
```

## 推荐方案：混合方案

### 第一阶段：ttyd + 扩展服务
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  API Gateway │────▶│    ttyd     │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Extension API│
                    │ - History    │
                    │ - Sessions   │
                    │ - Claude Ctrl│
                    └──────────────┘
```

**实现步骤**：
1. 使用 ttyd 提供基础终端功能
2. 开发独立的 Node.js 服务处理：
   - 命令历史记录
   - Claude Code 进程管理
   - 会话管理
3. 通过代理层整合两个服务

### 第二阶段：逐步替换
1. 先运行稳定
2. 逐步将 ttyd 功能迁移到自建服务
3. 最终完全替换

## 具体建议

**如果你需要快速上线（1-2周）**：
- 选择 ttyd + 扩展服务
- 通过 HTTP API 实现额外功能
- 使用 iframe 或修改 ttyd 前端集成

**如果你有充足时间（1-2月）**：
- 直接用核心组件构建
- 可以实现更好的用户体验
- 长期维护成本更低

**折中方案**：
1. 先用 ttyd 快速搭建原型
2. 同时开发自建版本
3. 测试稳定后切换

## 代码示例：ttyd 扩展方案

```javascript
// extension-server.js
const express = require('express');
const { spawn } = require('child_process');

class ClaudeWebExtension {
  constructor() {
    this.app = express();
    this.claudeProcess = null;
    this.commandHistory = [];
  }

  // 启动 Claude Code
  startClaude() {
    this.claudeProcess = spawn('claude', ['code'], {
      env: { ...process.env, CLAUDE_WEB: '1' }
    });
  }

  // 拦截和记录命令
  interceptCommand(command) {
    this.commandHistory.push({
      command,
      timestamp: new Date(),
      sessionId: this.sessionId
    });
  }

  // API 路由
  setupRoutes() {
    this.app.get('/api/history', (req, res) => {
      res.json(this.commandHistory);
    });

    this.app.post('/api/claude/restart', (req, res) => {
      this.restartClaude();
      res.json({ status: 'restarted' });
    });
  }
}
```

## 最终建议

基于你的需求，我建议：

**先用 ttyd + 扩展服务** 快速实现核心功能：
1. ttyd 处理终端显示和基础交互
2. Node.js 服务处理 Claude Code 管理和历史记录
3. 简单的 Web UI 整合两者

这样可以在 1-2 周内有可用版本，后续再根据使用反馈决定是否需要完全自建。