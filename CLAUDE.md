# Claude Web 项目记忆

## 项目概述
Claude Web 是一个基于 Web 的远程开发环境，允许用户通过浏览器访问和控制远程服务器上的 Claude Code 和 VS Code (Cursor)。

## 技术栈决策
- **架构方案**: 自建 PTY 方案（node-pty + WebSocket）
- **前端**: React + TypeScript + xterm.js + Material-UI
- **后端**: Fastify + WebSocket + node-pty
- **数据库**: PostgreSQL (用户认证) + Redis (会话管理)
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
- ✅ 移动端键盘适配优化
- ✅ iPhone 登录界面键盘处理
- ✅ 移动端调试界面实现
- ✅ 移动端虚拟键盘工具栏（ESC、翻页、方向键等）
- ✅ 修复移动端终端刷新问题（优化 ANSI 转义序列处理）
- ✅ 高级 ANSI 序列优化（移动端性能提升）
- ✅ 虚拟键盘工具栏自动隐藏（与 iOS 原生键盘同步）
- ✅ 增强虚拟键盘（Shift+Tab、nano 编辑器快捷键）
- ✅ 移动端终端手势支持 Hooks
- ✅ 智能 Tab 自动补全 Hook
- ✅ 移动端虚拟键盘工具栏优化（单排滚动布局）
- ✅ 自动滚动修复（键盘弹出时终端滚动到底部）
- ✅ 焦点管理优化（按钮点击后不保持选中状态）
- ✅ iOS 中文输入法兼容性修复（空格、数字、符号输入）
- ✅ 智能光标跟踪滚动系统（Claude Code 等中间输入场景）
- ✅ 容器隔离模式实现（Docker/Podman）
- ✅ 容器生命周期管理完善（自动清理、会话恢复）
- ✅ xterm.js 竞态条件彻底修复（延迟初始化+WebSocket时序优化）
- ✅ GitHub OAuth 集成实现（OAuth认证、仓库管理、Token刷新）
- ✅ VS Code Remote-SSH 集成方案实现（SSHpiper workingDir 模式）
- ✅ SSH 公钥认证系统实现（移除密码认证，仅支持公钥）
- ✅ SSHpiper workingDir 配置自动化
- ✅ SSH 公钥拖拽上传和智能解析
- ✅ 多 IDE 支持（VS Code、Cursor、Windsurf）
- ✅ 一键打开 IDE 功能实现
- ✅ Dockerode 集成实现（替代 node-pty + docker exec）

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
14. **2025-06-14**: 实现移动端键盘自适应，解决 iPhone 键盘遮挡问题
15. **2025-06-14**: 开发移动端调试界面，支持实时错误追踪
16. **2025-06-14**: 实现移动端虚拟键盘工具栏，提供 ESC、翻页等终端快捷键
17. **2025-06-14**: 优化移动端终端渲染性能，修复 ANSI 转义序列刷新问题
18. **2025-06-14**: 实现 WebSocket 心跳检测和连接数审计机制
19. **2025-06-14**: 实现高级 ANSI 序列检测和简化，提升移动端性能
20. **2025-06-14**: 实现虚拟键盘工具栏自动显示/隐藏，与 iOS 键盘同步
21. **2025-06-14**: 添加 Shift+Tab 和 nano 编辑器快捷键支持
22. **2025-06-14**: 创建 useMobileTerminalEnhancements 和 useTabCompletion Hooks
23. **2025-06-14**: 重构虚拟键盘工具栏为单排滚动布局，优化按钮排序和样式
24. **2025-06-14**: 修复移动端键盘弹出时终端自动滚动问题
25. **2025-06-14**: 实现按钮点击后焦点管理，防止保持选中状态
26. **2025-06-15**: 修复 iOS 中文输入法空格、数字、符号无法输入的问题
27. **2025-06-15**: 实现智能光标跟踪滚动，优化 Claude Code 等中间输入场景
28. **2025-06-15**: 实现容器隔离模式，支持 Docker/Podman，每个用户独立容器
29. **2025-06-15**: 实施隐私优先设计：
    - 移除所有命令历史数据库存储
    - 移除终端输出缓冲数据库存储
    - 仅保留最小化的用户认证和会话元数据
    - 所有敏感数据仅在内存中保存，不持久化
    - 数据库只存储：用户名、邮箱、密码哈希、会话ID和状态
30. **2025-06-15**: 完善容器生命周期管理：
    - 实现自动清理机制，每小时运行
    - 清理24小时无活动的容器
    - 支持服务器重启后会话恢复
    - 用户数据通过Docker Volume持久化
31. **2025-06-16**: 彻底修复 xterm.js 竞态条件问题：
    - 实现500ms延迟初始化避免 open()/fit() 过早调用
    - 添加完整的生命周期管理和状态检查机制
    - 实现WebSocket在终端就绪后连接的时序控制
    - 修复 syncScrollArea → this._renderService.dimensions TypeError
    - 防止 React 双渲染、SSR、路由切换等场景的竞态问题
32. **2025-06-16**: 实现 GitHub OAuth 集成：
    - 支持 OAuth 认证流程，用户可连接 GitHub 账号
    - 实现仓库列表同步和管理功能
    - 支持获取带 Token 的 clone URL，方便终端中克隆私有仓库
    - 实现 Token 自动刷新机制，确保长期可用
    - 添加撤销连接功能，支持完全断开 GitHub 连接
    - 使用最小权限原则：仅请求 `repo` scope，满足所有需求
    - 提供清晰的权限说明，让用户了解授权范围
33. **2025-06-15**: 确定 VS Code Remote-SSH 集成方案：
    - 选择 SSHpiper 作为 SSH 代理服务器
    - 基于用户名进行路由转发到对应容器
    - 单一端口（2222）服务所有用户
    - 动态配置更新，支持热重载
34. **2025-06-16**: 实现 SSHpiper workingDir 模式：
    - 切换到 workingDir 驱动，替代 YAML 配置
    - 实现公钥认证，移除密码认证提升安全性
    - SSHpiper 使用预配置密钥连接到容器
    - 用户公钥存储在 workingDir 的 authorized_keys 文件
    - 实现数据库和 workingDir 的自动同步机制
35. **2025-06-16**: 增强 SSH 公钥上传体验：
    - 支持拖拽上传 .pub 文件
    - 自动解析 SSH 公钥文件内容和注释
    - 智能提取密钥名称（从注释中获取 user@hostname）
    - 支持多种密钥格式（RSA、Ed25519、ECDSA）
    - 文件验证和错误提示机制
36. **2025-06-16**: 简化容器初始化流程：
    - 移除 syncSSHCredentials 方法，不再同步密钥到容器
    - 容器初始化仅创建 workspace 目录
    - 通过 Dockerfile 中的启动脚本恢复 SSH 密钥
    - SSHpiper 公钥保存到 /root/.ssh 作为备份
37. **2025-06-16**: 优化 IDE 连接体验：
    - 支持三个主流 IDE：VS Code、Cursor、Windsurf
    - 一键打开 IDE 功能，使用各自的 URL scheme
    - 简化 UI，移除冗余的手动连接步骤
    - 更紧凑的界面设计，避免滚动
38. **2025-06-16**: 数据库架构优化：
    - 移除 ssh_password 和 ssh_password_hash 字段
    - 仅保留 ssh_public_keys 用于公钥认证
    - 清理 API 响应，移除不需要的 instructions 字段
39. **2025-06-16**: 实现 Dockerode 集成方案：
    - 使用 Docker API 替代命令行工具，提升性能和可靠性
    - 支持远程 Docker daemon 连接 (DOCKER_HOST)
    - 解决服务器重启时 exec 进程自动清理问题
    - 创建 PtyAdapter 适配器，保持与 node-pty 接口兼容
    - 通过 USE_DOCKERODE=true 环境变量启用新模式
    - 向后兼容：默认使用原有的 node-pty 实现

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

### 移动端键盘适配
- **键盘检测**: 使用 visualViewport API 和 resize 事件检测键盘状态
- **布局自适应**: 键盘打开时自动调整界面布局，避免输入框被遮挡
- **自动滚动**: 聚焦输入框时自动滚动到可视区域
- **防缩放**: 设置输入框字体大小为 16px，防止 iOS Safari 自动缩放
- **调试界面**: 提供可视化调试面板，方便移动端错误排查

### 移动端虚拟键盘工具栏
- **单排滚动布局**: 紧凑的横向滚动设计，按使用频率排序
- **核心快捷键**: Tab、Enter、ESC、Ctrl+C、Ctrl+L 等最常用功能
- **方向键**: 内联排列的上下左右导航键
- **编辑功能**: Ctrl+U（清行）、Ctrl+W（删词）、Ctrl+R（搜索历史）
- **程序控制**: Ctrl+D（退出）、Ctrl+Z（挂起）
- **自动显隐**: 与 iOS 原生键盘同步显示/隐藏
- **位置自适应**: 自动调整到键盘上方，避免遮挡
- **焦点管理**: 点击后自动失焦，不保持选中状态
- **滚动提示**: 右侧"滑动→"提示，引导用户操作
- **现代样式**: 深色主题、圆角、阴影、悬停效果

### 移动端终端优化
- **DOM 渲染器**: 移动设备使用 DOM 渲染器替代 Canvas，提高稳定性
- **写入缓冲**: 批量处理终端输出，减少重绘次数
- **智能刷新**: 检测光标定位序列，优化进度条等更新场景
- **ANSI 序列优化**: 合并冗余光标移动，简化颜色代码，检测并优化复杂序列
- **高级 ANSI 检测**: 识别保存/恢复光标、清除行、光标定位等复杂序列
- **序列简化**: 自动合并连续的光标移动和样式设置命令
- **Resize 防抖**: 增加尺寸变化阈值和延迟，避免频繁重排
- **性能调优**: 减少滚动缓冲区大小，禁用光标闪烁
- **自动滚动**: 键盘弹出时自动滚动到底部，确保输入位置始终可见
- **智能光标跟踪**: scrollToCursor() 方法实现光标位置智能滚动，适配 Claude Code 等中间输入场景
- **容器适配**: 动态调整终端容器高度，避免被键盘遮挡
- **中文输入法优化**: 修复 iOS 中文输入法空格、数字、符号无法输入的问题，改进 IME 组合事件处理

### 自定义 React Hooks
- **useMobileTerminalEnhancements**: 移动端终端手势和增强功能支持
- **useTabCompletion**: 智能 Tab 自动补全，支持命令、路径、参数补全
- **手势支持**: 预留双指缩放、左右滑动等手势接口
- **补全缓存**: Tab 补全结果缓存，提升响应速度

### 连接管理和稳定性
- **WebSocket 心跳**: 每 30 秒发送 ping/pong 检测连接状态
- **自动断开**: 心跳失败时自动终止死连接
- **连接数审计**: 定期检查并修正过期的连接计数
- **会话清理**: 自动清理超过 24 小时的死会话
- **实时更新**: 连接/断开事件通过 WebSocket 广播更新

### 容器隔离模式
- **用户隔离**: 每个用户独立 Docker/Podman 容器
- **资源限制**: 支持内存、CPU 限制配置
- **持久存储**: 用户数据通过 Volume 持久化
- **安全性**: 容器间完全隔离，无法访问宿主机
- **开发环境**: 使用 claude-web-dev:latest 镜像
- **会话管理**: 所有会话在用户容器内运行
- **自动创建**: 首次访问时自动创建用户容器
- **生命周期管理**: 
  - 容器保持运行，支持会话恢复
  - 自动清理：每小时检查，移除24小时无活动容器
  - 服务器重启后自动恢复会话
  - 容器命名规则：claude-web-user-{userId}

### xterm.js 竞态条件修复系统
- **延迟初始化策略**: 500ms延迟确保DOM完全准备后再调用 terminal.open()
- **维度验证机制**: hasValidDimensions() 检查容器宽高和连接状态
- **生命周期状态管理**: isDisposedRef 和 isTerminalAlive() 防止已销毁组件操作
- **安全fit操作**: safeFit() 函数检查所有条件后再调用 fit()
- **ResizeObserver防护**: 回调中双重检查销毁状态，避免异步操作冲突
- **动画帧管理**: 取消 viewport._refreshAnimationFrame 防止销毁后回调
- **WebSocket时序控制**: 终端完全初始化后通过 onTerminalReady 回调才连接WebSocket
- **错误降级处理**: 所有关键操作都有 try-catch 和降级策略

### GitHub OAuth 集成
- **OAuth 认证流程**: 支持标准 GitHub OAuth 2.0 流程
- **安全状态验证**: 使用随机 state 参数防止 CSRF 攻击
- **仓库管理**: 
  - 自动同步用户的 GitHub 仓库列表
  - 支持公开和私有仓库
  - 本地缓存仓库信息，减少 API 调用
- **Token 管理**:
  - 安全存储 access_token 和 refresh_token
  - 自动检测 token 过期并刷新
  - 支持撤销 token 和断开连接
- **克隆支持**:
  - 生成带 OAuth token 的 HTTPS clone URL
  - 支持在终端中直接克隆私有仓库
  - 临时 token URL，使用后即失效
- **用户界面**:
  - Material-UI 风格的管理界面
  - 实时显示连接状态和用户信息
  - 支持搜索、筛选仓库列表

### VS Code Remote-SSH 集成
- **SSHpiper 代理服务器**:
  - 使用 SSHpiper 作为 SSH 代理层
  - 基于用户名路由到对应容器
  - 单一端口 (2222) 服务所有用户
  - 支持动态配置热重载
- **workingDir 驱动模式**:
  - 使用文件系统配置替代 YAML
  - 每个用户独立的 workingDir 目录
  - 实时同步数据库和文件系统配置
  - 支持 authorized_keys 和 sshpiper_upstream 文件
- **SSH 公钥认证**:
  - 仅支持公钥认证，移除密码认证
  - 支持拖拽上传 .pub 文件
  - 智能解析密钥文件内容和注释
  - 自动提取密钥名称 (user@hostname)
  - 支持 RSA、Ed25519、ECDSA 格式
- **多 IDE 支持**:
  - VS Code、Cursor、Windsurf 一键打开
  - 使用各自的 URL scheme (vscode-remote://, cursor://, windsurf://)
  - 自动生成 SSH 连接配置
  - 简化的连接流程，无需手动配置

## 测试策略
- 单元测试覆盖率 > 80%
- 集成测试覆盖所有 API
- 端到端测试覆盖关键用户流程
- 每次提交自动运行回归测试

## 常用命令
```bash
# 初始化 SSHpiper 配置 (首次运行必需)
./scripts/setup-sshpiper.sh

# 开发环境启动
# 后端 (端口 12021)
cd backend && pnpm run dev

# 前端 (端口 12020)  
cd frontend && pnpm start

# Docker 环境启动 (包含 SSHpiper)
docker-compose up -d

# 重建容器镜像 (当更新 Dockerfile 时)
docker-compose build

# 运行测试
pnpm test

# 构建生产版本
pnpm build

# 安装依赖
pnpm install

# 健康检查
curl http://localhost:12021/health

# 测试 SSHpiper 配置
./scripts/test-sshpiper-workingdir.sh

# 测试 SSH 公钥解析功能
./scripts/test-ssh-key-parsing.sh

# 测试 SSH 公钥错误处理
./scripts/test-ssh-key-error-handling.sh

# 测试 dockerode 集成
node scripts/test-dockerode.js

# 测试环境变量切换
node scripts/test-runtime-switch.js
```

