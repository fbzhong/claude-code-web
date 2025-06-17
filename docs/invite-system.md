# 邀请码系统使用指南

## 功能概述

Claude Web 的邀请码系统提供了一种安全的注册限制机制，允许管理员控制谁可以注册新账户。

## 启用邀请码系统

### 1. 后端配置

在后端环境变量中设置：

```bash
# .env 文件
REQUIRE_INVITE_CODE=true
```

### 2. 前端配置

在前端环境变量中设置：

```bash
# frontend/.env 文件
REACT_APP_REQUIRE_INVITE_CODE=true
```

## 管理邀请码

### 使用命令行工具

邀请码管理通过命令行工具完成，确保只有服务器管理员才能操作。

#### 创建邀请码

```bash
# 创建单个邀请码
npm run invite:create

# 创建多个邀请码
npm run invite:create -- --count 5

# 创建可多次使用的邀请码
npm run invite:create -- --max-uses 10

# 创建有时效的邀请码（7天后过期）
npm run invite:create -- --expires 7

# 创建带前缀的邀请码
npm run invite:create -- --prefix WELCOME

# 组合使用
npm run invite:create -- --count 3 --max-uses 5 --expires 30 --prefix BETA
```

#### 查看邀请码

```bash
# 查看所有有效的邀请码
npm run invite:list

# 查看所有邀请码（包括已使用和过期的）
npm run invite:list -- --all
```

#### 删除邀请码

```bash
# 删除未使用的邀请码
npm run invite:delete <CODE>
```

#### 禁用邀请码

```bash
# 禁用邀请码（保留记录但不能使用）
npm run invite:disable <CODE>
```

#### 查看统计信息

```bash
# 查看邀请码使用统计
npm run invite:stats
```

### 在生产环境中使用

#### Docker 环境

```bash
# 进入容器执行命令
docker exec -it claude-web-backend node dist/server.js invite:create --count 5

# 或使用 npm 脚本
docker exec -it claude-web-backend npm run invite:create -- --count 5
```

#### PM2 环境

```bash
# 使用 PM2 执行
pm2 exec claude-web-backend -- node dist/server.js invite:create --count 5
```

#### SSH 远程执行

```bash
# 远程创建邀请码
ssh user@server "cd /path/to/claude-web && npm run invite:create -- --count 5"
```

## 邀请码数据库结构

邀请码存储在 `invite_codes` 表中，包含以下字段：

- `id`: UUID 主键
- `code`: 邀请码（唯一）
- `created_by`: 创建者
- `created_at`: 创建时间
- `used_by`: 使用者 ID
- `used_at`: 使用时间
- `expires_at`: 过期时间
- `max_uses`: 最大使用次数
- `current_uses`: 当前使用次数
- `is_active`: 是否激活

## 安全性考虑

1. **命令行访问控制**：邀请码管理只能通过服务器命令行进行，需要 SSH 访问权限
2. **无 API 暴露**：没有提供任何 HTTP API 来管理邀请码，防止未授权访问
3. **事务性操作**：注册时使用数据库事务，确保邀请码使用的原子性
4. **多重验证**：检查邀请码的有效性、过期时间、使用次数等

## 注意事项

1. 启用邀请码系统后，所有新用户必须提供有效的邀请码才能注册
2. 前后端的环境变量必须同时设置，否则会出现不一致的行为
3. 邀请码区分大小写
4. 已使用的邀请码不能删除，只能禁用
5. 建议定期清理过期和已使用的邀请码