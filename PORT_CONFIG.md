# 端口配置

## 新端口分配
- **前端**: http://localhost:12020
- **后端**: http://localhost:12021

## 服务启动步骤

1. 启动后端:
```bash
cd backend
pnpm run dev
```
后端将在 http://localhost:12021 启动

2. 启动前端:
```bash
cd frontend  
pnpm start
```
前端将在 http://localhost:12020 启动

3. 验证服务:
```bash
# 检查后端健康状态
curl http://localhost:12021/health

# 访问前端应用
open http://localhost:12020
```

## WebSocket连接
- WebSocket URL: `ws://localhost:12021/ws/terminal/{sessionId}?token={jwt_token}`

## 测试账号
- 用户名: testuser
- 密码: testpass123

## 修改内容
1. 后端: `backend/src/app.ts` - 默认端口改为12021
2. 前端: `frontend/package.json` - 启动脚本设置PORT=12020  
3. 前端: `frontend/package.json` - proxy设置为http://localhost:12021
4. 前端: `frontend/src/services/websocket.ts` - WebSocket URL更新为12021端口