# Claude Web Code Server

一个基于 Web 的远程开发环境，允许用户通过浏览器访问和控制远程服务器上的 Claude Code 和 VS Code。

## 主要特性

- 🌐 **Web 终端**: 基于 xterm.js 的完整终端体验
- 🔒 **容器隔离**: 每个用户独立的 Docker 容器环境
- 💻 **IDE 集成**: 支持 VS Code、Cursor、Windsurf 一键连接
- 🔑 **SSH 访问**: 通过 SSHpiper 实现安全的 SSH 连接
- 📱 **移动端支持**: 完善的移动端适配和虚拟键盘
- 🎯 **会话管理**: 支持多会话创建、切换和持久化

## 快速开始

### 前置要求

- Docker 和 Docker Compose
- Node.js 18+ 和 pnpm
- PostgreSQL 数据库

### 安装步骤

1. 克隆仓库
```bash
git clone <repository-url>
cd claude-web-code-server
```

2. 安装依赖
```bash
pnpm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的配置
```

4. 初始化 SSHpiper
```bash
./scripts/setup-sshpiper.sh
```

5. 启动服务
```bash
# 开发模式
pnpm dev

# 生产模式
docker-compose up -d
```

## 架构说明

- **前端**: React + TypeScript + Material-UI
- **后端**: Fastify + WebSocket + node-pty
- **数据库**: PostgreSQL + Redis
- **容器**: Docker/Podman + SSHpiper
- **IDE集成**: Remote-SSH 协议

## 使用指南

1. 访问 `http://localhost:12020`
2. 注册或登录账号
3. 创建新的终端会话
4. 通过 SSH 或 IDE 连接到你的开发环境

## 开发说明

详细的开发文档请参考：
- [CLAUDE.md](./CLAUDE.md) - 项目决策和技术细节
- [FEATURE.md](./FEATURE.md) - 功能需求文档

## License

MIT