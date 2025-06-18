# Claude Web

基于 Web 的远程开发环境，允许用户通过浏览器访问和控制远程服务器上的 Claude Code 和 VS Code。

## 主要特性

- 🌐 **Web 终端**: 基于 xterm.js 的完整终端体验
- 🔒 **容器隔离**: 每个用户独立的 Docker 容器
- 💻 **IDE 集成**: 一键连接 VS Code、Cursor、Windsurf
- 🔑 **SSH 访问**: 通过 SSHpiper 实现安全的 SSH 连接
- 🐙 **GitHub 集成**: OAuth 集成，管理代码仓库
- 📱 **移动端支持**: 响应式设计，虚拟键盘支持
- 🎯 **会话管理**: 多会话支持，实时状态更新
- 🎟️ **邀请系统**: 可选的邀请码注册控制

## 快速开始

### 前置要求

- Docker 和 Docker Compose
- Node.js 20+ (LTS) 和 npm（开发环境需要）
- PostgreSQL（Docker 安装包含）

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/fbzhong/claude-web.git
cd claude-web
```

2. **配置环境变量**

```bash
cp .env.production.example .env.prod
# 编辑 .env.prod 文件，填入你的配置
```

3. **使用 Docker 部署**

```bash
./deploy.sh
```

## 开发环境设置

### 本地开发

1. **安装依赖**

```bash
# 安装 pnpm（如果尚未安装）
npm install -g pnpm

# 安装依赖（从项目根目录）
pnpm install
```

2. **设置数据库**

```bash
# 启动 PostgreSQL
docker compose up -d postgres

# 运行数据库迁移
psql -U claude_web -d claude_web -f scripts/init-db.sql
```

3. **配置环境变量**

```bash
# 后端配置
cd backend
cp .env.example .env
# 编辑 backend/.env

# 前端配置
cd ../frontend
cp .env.example .env
# 编辑 frontend/.env
```

4. **启动开发服务器**

```bash
# 终端 1：后端（端口 12021）
cd backend && pnpm run dev

# 终端 2：前端（端口 12020）
cd frontend && pnpm start
```

### 项目结构

```
claude-web/
├── backend/          # Fastify API 服务器
├── frontend/         # React 应用
├── docker/           # Docker 配置
│   ├── dev/          # 用户开发容器
│   └── sshpiper/     # SSHpiper 容器
├── scripts/          # 工具脚本
├── sshpiper/         # SSH 代理运行时数据
├── data/             # 数据库和持久化数据
└── docs/             # 文档
```

## 生产环境部署

### 使用 Docker Compose

1. **准备环境**

```bash
# 自动化部署（推荐）
./deploy.sh

# 脚本将自动：
# - 检查 .env.prod 配置文件
# - 创建必要的目录
# - 生成 SSH 密钥
# - 构建并启动所有服务
```

**手动配置（可选）：**

```bash
# 复制并配置环境变量
cp .env.production.example .env.prod
vim .env.prod

# 必需的变量：
# - DATABASE_PASSWORD（生成：openssl rand -hex 32）
# - JWT_SECRET（生成：openssl rand -hex 32）
# - ENCRYPTION_KEY（生成：openssl rand -hex 32）
# - GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET（手动设置）

# 然后运行部署
./deploy.sh
```

2. **创建邀请码（如果启用）**

```bash
# 在 .env.prod 中设置 REQUIRE_INVITE_CODE=true，然后：
docker exec claude-web-backend npm run invite:create -- --count 10
```

3. **服务管理**

```bash
# 查看日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# 停止服务
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# 重启服务
docker compose -f docker-compose.prod.yml --env-file .env.prod restart
```

### 服务端口

- 前端界面：`http://localhost:12020`
- 后端 API：`http://localhost:12021`
- SSH 连接：`ssh username@localhost -p 2222`

### HTTPS 配置（nginx）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:12020;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:12021;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 使用指南

### 用户使用

1. **注册/登录**
   - 访问 `http://your-domain.com`
   - 使用邮箱和密码注册
   - 如果需要，输入邀请码

2. **使用 Web 终端**
   - 点击"新建会话"创建终端
   - 运行 `claude` 启动 Claude Code
   - 像普通终端一样使用

3. **连接 IDE**
   - 进入设置 → SSH 密钥
   - 上传你的 SSH 公钥
   - 点击"在 VS Code/Cursor/Windsurf 中打开"
   - 或手动连接：`ssh your-email@your-domain.com -p 2222`

4. **GitHub 集成**
   - 在设置中连接 GitHub 账号
   - 一键克隆私有仓库
   - 自动管理访问令牌

### 管理员操作

#### 管理邀请码

```bash
# 创建邀请码
docker exec claude-web-backend npm run invite:create -- --count 5

# 查看邀请码
docker exec claude-web-backend npm run invite:list

# 删除邀请码
docker exec claude-web-backend npm run invite:delete CODE123
```

#### 监控

```bash
# 查看服务状态
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# 查看日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# 监控资源使用
docker stats --filter "name=claude-web"
```

#### 维护

```bash
# 备份数据库
docker exec claude-web-postgres pg_dump -U claude_web claude_web > backup.sql

# 更新部署
git pull
./deploy.sh

# 清理旧容器
docker exec claude-web-backend npm run cleanup:containers
```

## 架构说明

### 技术栈

- **前端**：React + TypeScript + Material-UI + xterm.js
- **后端**：Fastify + WebSocket + node-pty/dockerode
- **数据库**：PostgreSQL（用户、会话、GitHub 连接）
- **容器**：Docker/Podman，用户环境隔离
- **IDE 集成**：SSHpiper 实现 Remote-SSH 协议
- **认证**：JWT + bcrypt

### 安全特性

- 用户容器隔离
- 仅支持 SSH 公钥认证
- JWT 令牌认证
- 敏感数据加密
- 不存储命令历史
- 邀请码注册控制

## 环境变量

完整配置指南请参考 [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)。

主要变量：

- `JWT_SECRET`：JWT 签名密钥
- `ENCRYPTION_KEY`：数据加密密钥
- `GITHUB_CLIENT_ID/SECRET`：GitHub OAuth 凭据
- `CONTAINER_MEMORY_LIMIT`：每用户内存限制（默认：2g）
- `REQUIRE_INVITE_CODE`：启用邀请系统
- `SSHPIPER_DIR`：SSHpiper 文件基础目录

## 开发

### 运行测试

```bash
# 后端测试
cd backend && pnpm test

# 前端测试
cd frontend && pnpm test

# 所有测试
pnpm test
```

### 构建生产版本

```bash
# 构建后端
cd backend && pnpm run build

# 构建前端
cd frontend && pnpm run build

# 构建全部
pnpm build

# 构建 Docker 镜像
docker compose -f docker-compose.prod.yml build
```

### 贡献代码

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 创建 Pull Request

## 文档

- [CLAUDE.md](./CLAUDE.md) - 项目决策和技术细节
- [FEATURE.md](./FEATURE.md) - 功能需求文档
- [环境变量](./docs/ENVIRONMENT_VARIABLES.md) - 配置指南

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 支持

- 问题反馈：[GitHub Issues](https://github.com/fbzhong/claude-web/issues)
- 讨论交流：[GitHub Discussions](https://github.com/fbzhong/claude-web/discussions)
