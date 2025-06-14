# Claude Web 项目记忆

## 项目概述
Claude Web 是一个基于 Web 的远程开发环境，允许用户通过浏览器访问和控制远程服务器上的 Claude Code 和 VS Code (Cursor)。

## 技术栈决策
- **架构方案**: 自建 PTY 方案（node-pty + WebSocket）
- **前端**: React + TypeScript + xterm.js + Material-UI
- **后端**: Fastify + WebSocket + node-pty
- **数据库**: PostgreSQL (历史记录) + Redis (会话管理)
- **IDE集成**: code-server
- **部署**: Docker + Docker Compose
- **包管理**: pnpm (monorepo)

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
- ✅ 架构方案确定（自建 PTY 方案）
- ✅ 需求文档创建 (FEATURE.md)
- ✅ 项目结构搭建完成
- ✅ 后端框架实现 (Fastify + WebSocket + node-pty)
- ✅ 测试框架配置完成
- ✅ CI/CD 流水线配置
- ✅ Docker 部署配置
- ✅ 前端界面开发完成
- ✅ 用户认证系统实现
- ✅ WebSocket 连接成功
- ✅ xterm.js dimensions 错误修复 (StableTerminal)
- ✅ UI 样式优化（VS Code 风格）
- ✅ WebSocket 错误处理改进
- ✅ 会话管理功能实现（创建、切换、删除、重命名）
- ✅ 会话持久化存储实现（PostgreSQL）
- ✅ 终端高度自适应修复（FitAddon）
- ✅ 会话输出缓冲持久化实现
- ✅ 会话历史恢复功能
- ✅ 移动端响应式设计实现
- ✅ Session List 实时更新（WebSocket）
- ✅ 智能 CWD 检测系统实现
- ✅ 路径智能缩写显示
- ✅ 执行状态实时检测
- 🔄 Claude Code 进程管理开发中

## 关键决策记录
1. **2025-06-14**: 最初选择 ttyd 混合方案，后决定使用 node-pty 自建方案
2. **2025-06-14**: 确定使用 Node.js 生态系统，便于快速开发和维护
3. **2025-06-14**: 选择 Fastify 替代 Express，提升性能
4. **2025-06-14**: 使用 pnpm 作为包管理器，支持 monorepo 结构
5. **2025-06-14**: 修复 xterm.js dimensions 错误，降级到 xterm@4.19.0 稳定版本
6. **2025-06-14**: 创建多个终端组件尝试，最终使用 StableTerminal
7. **2025-06-14**: 实现会话持久化，使用 PostgreSQL 存储会话状态和输出缓冲
8. **2025-06-14**: 使用单例模式确保 SessionManager 一致性
9. **2025-06-14**: 实现输出缓冲分块存储，保留 ANSI 转义序列
10. **2025-06-14**: 实现移动端响应式设计，统一使用左侧 Drawer
11. **2025-06-14**: 实现智能 CWD 检测，使用 lsof (macOS) 和 /proc (Linux)
12. **2025-06-14**: 采用事件驱动的 CWD 检测策略替代定时检查
13. **2025-06-14**: 实现路径智能缩写，支持中文目录名显示

## 技术特性

### 智能 CWD 检测系统
- **事件驱动检测**: 用户按 Enter 后 1 秒检查 CWD
- **输出空闲检测**: 终端输出停止 1 秒后检查 CWD  
- **跨平台支持**: macOS 使用 lsof，Linux 使用 /proc
- **定时器管理**: 每个 session 独立定时器，支持自动清理
- **精确 lsof 命令**: `lsof -p PID -a -d cwd | tail -n +2 | awk '{print $NF}'`

### 路径智能缩写
- **Home 目录**: `/Users/fbzhong/Downloads/简历` → `~/D/简历`
- **非 Home 目录**: `/var/log/nginx/access.log` → `/V/L/N/access.log`
- **中文支持**: 支持中文目录名的首字母缩写
- **智能规则**: 保留最后一级目录完整名称，中间目录首字母大写

### 实时状态检测
- **执行状态**: 检测 shell 是否有程序正在执行
- **WebSocket 实时更新**: Session List 实时显示 CWD、命令、状态
- **视觉指示器**: 执行中显示动画图标，空闲显示状态圆点
- **自动重连**: WebSocket 连接断开时自动重试

### 响应式设计
- **统一 Drawer**: PC 和移动端都使用左侧抽屉式 Session 列表
- **Material-UI**: 使用 Material-UI 组件实现现代化界面
- **断点适配**: 针对不同屏幕尺寸优化布局和字体大小

## 测试策略
- 单元测试覆盖率 > 80%
- 集成测试覆盖所有 API
- 端到端测试覆盖关键用户流程
- 每次提交自动运行回归测试

## 常用命令
```bash
# 开发环境启动
# 后端 (端口 12021)
cd backend && pnpm run dev

# 前端 (端口 12020)  
cd frontend && pnpm start

# 运行测试
pnpm test

# 构建生产版本
pnpm build

# 安装依赖
pnpm install

# 健康检查
curl http://localhost:12021/health
```

