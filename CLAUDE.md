# Claude Web 项目记忆

## 项目概述
Claude Web 是一个基于 Web 的远程开发环境，允许用户通过浏览器访问和控制远程服务器上的 Claude Code 和 VS Code (Cursor)。

## 技术栈决策
- **架构方案**: ttyd 混合方案（ttyd + Node.js 扩展服务）
- **前端**: React + TypeScript + xterm.js
- **后端**: Node.js + Express + Socket.IO
- **数据库**: PostgreSQL (历史记录) + Redis (会话管理)
- **IDE集成**: code-server
- **部署**: Docker + Docker Compose

## 核心需求
1. 远程服务器上启动 Claude Code
2. 用户通过 Web 访问终端，查看历史，实时交互
3. 集成 VS Code (Cursor)，在 Web 上查看代码修改

## 开发要求
- 所有功能需求记录在 FEATURE.md
- 持续保存项目记忆到 CLAUDE.md
- 必须编写测试用例，持续回归测试

## 项目状态
- ✅ 技术调研完成
- ✅ 架构方案确定
- ✅ 需求文档创建
- ✅ 项目结构搭建完成
- ✅ 后端框架实现 (Fastify + WebSocket)
- ✅ 测试框架配置完成
- ✅ CI/CD 流水线配置
- ✅ Docker 部署配置
- 🔄 前端界面开发中

## 关键决策记录
1. **2025-06-14**: 选择 ttyd 混合方案而非完全自建，考虑快速上线需求
2. **2025-06-14**: 确定使用 Node.js 生态系统，便于快速开发和维护

## 测试策略
- 单元测试覆盖率 > 80%
- 集成测试覆盖所有 API
- 端到端测试覆盖关键用户流程
- 每次提交自动运行回归测试

## 常用命令
```bash
# 开发环境启动
pnpm dev

# 运行测试
pnpm test

# 构建生产版本
pnpm build

# 安装依赖
pnpm install

# 设置开发环境
./setup.sh
```

