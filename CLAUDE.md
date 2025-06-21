# Claude Code Web Project Memory

## Project Overview

Claude Code Web is a web-based remote development environment that allows users to access and control Claude Code and VS Code (Cursor) on remote servers through their browser.

## Technology Stack Decisions

- **Architecture**: Self-built PTY solution (node-pty + WebSocket)
- **Frontend**: React + TypeScript + xterm.js + Material-UI
- **Backend**: Fastify + WebSocket + node-pty
- **Database**: PostgreSQL (user authentication)
- **IDE Integration**: code-server
- **Deployment**: Docker + Docker Compose
- **Package Management**: pnpm (monorepo)

## Core Requirements

1. Launch Claude Code on remote server
2. Users access terminal via web, view history, real-time interaction
3. Integrate VS Code (Cursor), view code changes on web

## Development Requirements

- All feature requirements recorded in FEATURE.md
- Continuously save project memory to CLAUDE.md
- Must write test cases, continuous regression testing

## Project Status

- ✅ Technical research completed
- ✅ Architecture solution determined (self-built PTY solution)
- ✅ Requirements document created (FEATURE.md)
- ✅ Project structure setup completed
- ✅ Backend framework implemented (Fastify + WebSocket + node-pty)
- ✅ Test framework configuration completed
- ✅ CI/CD pipeline configured
- ✅ Docker deployment configured
- ✅ Frontend interface development completed
- ✅ User authentication system implemented
- ✅ WebSocket connection successful
- ✅ xterm.js dimensions error fixed (StableTerminal)
- ✅ UI style optimization (VS Code style)
- ✅ WebSocket error handling improved
- ✅ Session management features implemented (create, switch, delete, rename)
- ✅ Session management implemented (in-memory)
- ✅ Terminal height adaptive fix (FitAddon)
- ✅ Session output buffering implemented (in-memory)
- ✅ Real-time session management features
- ✅ Mobile responsive design implemented
- ✅ Session List real-time updates (WebSocket)
- ✅ Smart CWD detection system implemented
- ✅ Path smart abbreviation display
- ✅ Execution status real-time detection
- ✅ Mobile keyboard adaptation optimization
- ✅ iPhone login interface keyboard handling
- ✅ Mobile debug interface implemented
- ✅ Mobile virtual keyboard toolbar (ESC, page navigation, arrow keys, etc.)
- ✅ Fixed mobile terminal refresh issues (optimized ANSI escape sequence handling)
- ✅ Advanced ANSI sequence optimization (mobile performance improvement)
- ✅ Virtual keyboard toolbar auto-hide (synchronized with iOS native keyboard)
- ✅ Enhanced virtual keyboard (Shift+Tab, nano editor shortcuts)
- ✅ Mobile terminal gesture support Hooks
- ✅ Smart Tab auto-completion Hook
- ✅ Mobile virtual keyboard toolbar optimization (single-row scrolling layout)
- ✅ Auto-scroll fix (terminal scrolls to bottom when keyboard appears)
- ✅ Focus management optimization (buttons don't retain selected state after click)
- ✅ iOS Chinese input method compatibility fix (space, numbers, symbols input)
- ✅ Smart cursor tracking scroll system (Claude Code mid-input scenarios)
- ✅ Container isolation mode implemented (Docker/Podman)
- ✅ Container lifecycle management improved (auto-cleanup, session recovery)
- ✅ xterm.js race condition thoroughly fixed (delayed initialization + WebSocket timing optimization)
- ✅ GitHub OAuth integration implemented (OAuth authentication, repository management, Token refresh)
- ✅ VS Code Remote-SSH integration solution implemented (SSHpiper workingDir mode)
- ✅ SSH public key authentication system implemented (removed password authentication, public key only)
- ✅ SSHpiper workingDir configuration automation
- ✅ SSH public key drag-and-drop upload and smart parsing
- ✅ Multi-IDE support (VS Code, Cursor, Windsurf)
- ✅ One-click IDE open feature implemented
- ✅ Dockerode integration implemented (replacing node-pty + docker exec)
- ✅ Invite code registration restriction system implemented
- ✅ Dynamic configuration management system implemented
- ✅ Inlets tunnel feature implemented (similar to ngrok, expose container services to public internet)

## Key Decision Records

1. **2025-06-14**: Initially chose ttyd hybrid solution, later decided to use node-pty self-built solution
2. **2025-06-14**: Decided to use Node.js ecosystem for rapid development and maintenance
3. **2025-06-14**: Chose Fastify over Express for performance improvement
4. **2025-06-14**: Used pnpm as package manager, supporting monorepo structure
5. **2025-06-14**: Fixed xterm.js dimensions error, downgraded to xterm@4.19.0 stable version
6. **2025-06-14**: Created multiple terminal component attempts, finally used StableTerminal
7. **2025-06-14**: Implemented session management, maintaining session state and output buffer in memory
8. **2025-06-14**: Used singleton pattern to ensure SessionManager consistency
9. **2025-06-14**: Implemented output buffer chunked storage, preserving ANSI escape sequences
10. **2025-06-14**: Implemented mobile responsive design, unified left-side Drawer usage
11. **2025-06-14**: Implemented smart CWD detection, using lsof (macOS) and /proc (Linux)
12. **2025-06-14**: Adopted event-driven CWD detection strategy replacing scheduled checks
13. **2025-06-14**: Implemented path smart abbreviation, supporting Chinese directory name display
14. **2025-06-14**: Implemented mobile keyboard adaptation, solving iPhone keyboard occlusion issues
15. **2025-06-14**: Developed mobile debug interface, supporting real-time error tracking
16. **2025-06-14**: Implemented mobile virtual keyboard toolbar, providing ESC, page navigation and other terminal shortcuts
17. **2025-06-14**: Optimized mobile terminal rendering performance, fixed ANSI escape sequence refresh issues
18. **2025-06-14**: Implemented WebSocket heartbeat detection and connection count audit mechanism
19. **2025-06-14**: Implemented advanced ANSI sequence detection and simplification, improving mobile performance
20. **2025-06-14**: Implemented virtual keyboard toolbar auto show/hide, synchronized with iOS keyboard
21. **2025-06-14**: Added Shift+Tab and nano editor shortcut support
22. **2025-06-14**: Created useMobileTerminalEnhancements and useTabCompletion Hooks
23. **2025-06-14**: Refactored virtual keyboard toolbar to single-row scrolling layout, optimized button ordering and styling
24. **2025-06-14**: Fixed terminal auto-scroll issue when mobile keyboard appears
25. **2025-06-14**: Implemented button focus management after click, preventing retained selected state
26. **2025-06-15**: Fixed iOS Chinese input method space, numbers, symbols input issues
27. **2025-06-15**: Implemented smart cursor tracking scroll, optimized Claude Code mid-input scenarios
28. **2025-06-15**: Implemented container isolation mode, supporting Docker/Podman, independent container per user
29. **2025-06-15**: Implemented privacy-first design:
    - Removed all command history database storage
    - Removed terminal output buffer database storage
    - Retained only minimal user authentication and session metadata
    - All sensitive data stored only in memory, not persisted
    - Database only stores: username, email, password hash, session ID and status
30. **2025-06-15**: Improved container lifecycle management:
    - Implemented auto-cleanup mechanism, runs hourly
    - Cleans up containers inactive for 24 hours
    - Supports session recovery after server restart
    - User data persisted through Docker Volume
31. **2025-06-16**: Thoroughly fixed xterm.js race condition issues:
    - Implemented 500ms delayed initialization to avoid premature open()/fit() calls
    - Added complete lifecycle management and state checking mechanism
    - Implemented WebSocket connection timing control after terminal is ready
    - Fixed syncScrollArea → this._renderService.dimensions TypeError
    - Prevented race conditions in React double render, SSR, route switching scenarios
32. **2025-06-16**: Implemented GitHub OAuth integration:
    - Supports OAuth authentication flow, users can connect GitHub account
    - Implemented repository list sync and management features
    - Supports getting clone URL with Token, convenient for cloning private repos in terminal
    - Implemented Token auto-refresh mechanism, ensuring long-term availability
    - Added revoke connection feature, supports complete GitHub disconnection
    - Uses minimal permission principle: only requests `repo` scope, satisfies all needs
    - Provides clear permission explanations, letting users understand authorization scope
33. **2025-06-15**: Determined VS Code Remote-SSH integration solution:
    - Chose SSHpiper as SSH proxy server
    - Routes based on username to corresponding container
    - Single port (2222) serves all users
    - Dynamic configuration updates, supports hot reload
34. **2025-06-16**: Implemented SSHpiper workingDir mode:
    - Switched to workingDir driver, replacing YAML configuration
    - Implemented public key authentication, removed password authentication for improved security
    - SSHpiper uses pre-configured keys to connect to containers
    - User public keys stored in workingDir's authorized_keys file
    - Implemented automatic sync mechanism between database and workingDir
35. **2025-06-16**: Enhanced SSH public key upload experience:
    - Supports drag-and-drop upload of .pub files
    - Automatically parses SSH public key file content and comments
    - Smart extraction of key name (from user@hostname in comments)
    - Supports multiple key formats (RSA, Ed25519, ECDSA)
    - File validation and error prompting mechanism
36. **2025-06-16**: Simplified container initialization process:
    - Removed syncSSHCredentials method, no longer syncing keys to containers
    - Container initialization only creates workspace directory
    - SSH keys restored through startup script in Dockerfile
    - SSHpiper public key saved to /root/.ssh as backup
37. **2025-06-16**: Optimized IDE connection experience:
    - Supports three major IDEs: VS Code, Cursor, Windsurf
    - One-click IDE open feature, using respective URL schemes
    - Simplified UI, removed redundant manual connection steps
    - More compact interface design, avoiding scrolling
38. **2025-06-16**: Database architecture optimization:
    - Removed ssh_password and ssh_password_hash fields
    - Retained only ssh_public_keys for public key authentication
    - Cleaned up API responses, removed unnecessary instructions field
39. **2025-06-16**: Implemented Dockerode integration solution:
    - Used Docker API instead of command line tools, improving performance and reliability
    - Supports remote Docker daemon connection (CONTAINER_HOST)
    - Solved exec process auto-cleanup issue during server restart
    - Created PtyAdapter to maintain compatibility with node-pty interface
    - Backward compatible: defaults to original node-pty implementation
40. **2025-06-17**: Implemented invite code registration restriction system:
    - Command line tool management, no API exposure, ensuring security
    - Supports various invite code options: quantity limit, time validity, usage count, prefix
    - Integrated into main program, shares database connection and configuration
    - Supports Docker/PM2 production environment execution methods
    - Frontend and backend controlled via REQUIRE_INVITE_CODE environment variable
    - Database transactions ensure atomicity of invite code usage
41. **2025-06-17**: Removed session persistence feature:
    - Confirmed limitation that sessions cannot be reconnected
    - Deleted all session database storage code
    - Deleted persistent_sessions table
    - Sessions are now completely ephemeral
    - Sessions cannot be recovered after disconnection
    - Simplified architecture, improved performance and privacy
42. **2025-06-20**: Implemented dynamic configuration management system:
    - Created ConfigManager class, supports runtime configuration updates
    - Database stores configuration, environment variables as override options
    - Implemented configuration command line tool, similar to invite code management
    - Supports configuration import/export and audit logs
    - Real-time configuration updates, no service restart needed
43. **2025-06-20**: Completed migration from environment variables to dynamic configuration:
    - Migrated REQUIRE_INVITE_CODE, CONTAINER_MODE, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_OAUTH_CALLBACK_URL to dynamic configuration
    - Implemented configuration priority: database-managed configurations ignore environment variables
    - Frontend gets configuration via /api/config, removing environment variable dependency
    - CLI displays effective values (including defaults)
44. **2025-06-21**: Implemented Inlets tunnel feature:
    - Integrated Inlets OSS as tunnel server, supports HTTP/HTTPS tunnels
    - Containers pre-installed with inlets client, users can expose services via `tunnel <port>` command
    - Implemented tunnel status API, real-time display of active tunnel list
    - Supports development and production environment configuration, production supports HTTPS and custom domains
    - Tunnel feature enablement and configuration managed through dynamic configuration

## Technical Features

### Smart CWD Detection System

- **Event-driven detection**: Check CWD 1 second after user presses Enter
- **Output idle detection**: Check CWD 1 second after terminal output stops
- **Cross-platform support**: macOS uses lsof, Linux uses /proc
- **Timer management**: Independent timer per session, supports auto-cleanup
- **Precise lsof command**: `lsof -p PID -a -d cwd | tail -n +2 | awk '{print $NF}'`

### Path Smart Abbreviation

- **Home directory**: `/Users/fbzhong/Downloads/Resume` → `~/D/Resume`
- **Non-home directory**: `/var/log/nginx/access.log` → `/V/L/N/access.log`
- **Chinese support**: Supports first-letter abbreviation of Chinese directory names
- **Smart rules**: Preserves full name of last directory level, capitalizes first letter of intermediate directories

### Real-time Status Detection

- **Execution status**: Detects if shell has programs running
- **WebSocket real-time updates**: Session List displays CWD, commands, status in real-time
- **Visual indicators**: Shows animated icon during execution, status dot when idle
- **Auto-reconnect**: Automatically retries when WebSocket connection drops

### Responsive Design

- **Unified Drawer**: Both PC and mobile use left-side drawer-style Session list
- **Material-UI**: Uses Material-UI components for modern interface
- **Breakpoint adaptation**: Optimizes layout and font size for different screen sizes

### Mobile Keyboard Adaptation

- **Keyboard detection**: Uses visualViewport API and resize events to detect keyboard state
- **Layout adaptation**: Automatically adjusts interface layout when keyboard opens, avoiding input occlusion
- **Auto-scroll**: Automatically scrolls to visible area when focusing input
- **Prevent zoom**: Sets input font size to 16px, preventing iOS Safari auto-zoom
- **Debug interface**: Provides visual debug panel for mobile error troubleshooting

### Mobile Virtual Keyboard Toolbar

- **Single-row scrolling layout**: Compact horizontal scrolling design, ordered by usage frequency
- **Core shortcuts**: Tab, Enter, ESC, Ctrl+C, Ctrl+L and other most commonly used functions
- **Arrow keys**: Inline-arranged up/down/left/right navigation keys
- **Edit functions**: Ctrl+U (clear line), Ctrl+W (delete word), Ctrl+R (search history)
- **Program control**: Ctrl+D (exit), Ctrl+Z (suspend)
- **Auto show/hide**: Synchronized show/hide with iOS native keyboard
- **Position adaptation**: Automatically adjusts above keyboard, avoiding occlusion
- **Focus management**: Auto-blur after click, doesn't retain selected state
- **Scroll hint**: "Slide→" hint on right side, guiding user operation
- **Modern styling**: Dark theme, rounded corners, shadows, hover effects

### Mobile Terminal Optimization

- **DOM renderer**: Mobile devices use DOM renderer instead of Canvas for improved stability
- **Write buffer**: Batch processes terminal output, reducing redraw frequency
- **Smart refresh**: Detects cursor positioning sequences, optimizes progress bar update scenarios
- **ANSI sequence optimization**: Merges redundant cursor moves, simplifies color codes, detects and optimizes complex sequences
- **Advanced ANSI detection**: Recognizes save/restore cursor, clear line, cursor positioning and other complex sequences
- **Sequence simplification**: Automatically merges consecutive cursor movement and style setting commands
- **Resize debounce**: Adds size change threshold and delay, avoiding frequent reflow
- **Performance tuning**: Reduces scroll buffer size, disables cursor blink
- **Auto-scroll**: Automatically scrolls to bottom when keyboard appears, ensuring input position always visible
- **Smart cursor tracking**: scrollToCursor() method implements smart scrolling to cursor position, adapting to Claude Code mid-input scenarios
- **Container adaptation**: Dynamically adjusts terminal container height, avoiding keyboard occlusion
- **Chinese input method optimization**: Fixed iOS Chinese input method space, numbers, symbols input issues, improved IME composition event handling

### Custom React Hooks

- **useMobileTerminalEnhancements**: Mobile terminal gestures and enhancement features support
- **useTabCompletion**: Smart Tab auto-completion, supports command, path, parameter completion
- **Gesture support**: Reserved two-finger zoom, left/right swipe gesture interfaces
- **Completion cache**: Tab completion result caching, improves response speed

### Connection Management and Stability

- **WebSocket heartbeat**: Sends ping/pong every 30 seconds to detect connection status
- **Auto-disconnect**: Automatically terminates dead connections when heartbeat fails
- **Connection count audit**: Periodically checks and corrects expired connection counts
- **Session cleanup**: Automatically cleans up dead sessions older than 24 hours
- **Real-time updates**: Connection/disconnect events broadcast via WebSocket

### Container Isolation Mode

- **User isolation**: Independent Docker/Podman container per user
- **Resource limits**: Supports memory, CPU limit configuration
- **User data**: User files stored via Docker Volume
- **Security**: Complete isolation between containers, no access to host machine
- **Development environment**: Uses claude-web-dev:latest image
- **Session management**: All sessions run within user container
- **Auto-creation**: Automatically creates user container on first access
- **Lifecycle management**:
  - Containers remain running, supporting session recovery
  - Auto-cleanup: Checks hourly, removes containers inactive for 24 hours
  - Automatically recovers sessions after server restart
  - Container naming rule: claude-web-user-{userId}

### xterm.js Race Condition Fix System

- **Delayed initialization strategy**: 500ms delay ensures DOM is fully ready before calling terminal.open()
- **Dimension validation mechanism**: hasValidDimensions() checks container width/height and connection status
- **Lifecycle state management**: isDisposedRef and isTerminalAlive() prevent operations on destroyed components
- **Safe fit operation**: safeFit() function checks all conditions before calling fit()
- **ResizeObserver guard**: Double-checks destroyed state in callback, avoiding async operation conflicts
- **Animation frame management**: Cancels viewport._refreshAnimationFrame to prevent callbacks after destruction
- **WebSocket timing control**: Terminal fully initialized before connecting WebSocket via onTerminalReady callback
- **Error fallback handling**: All critical operations have try-catch and fallback strategies

### GitHub OAuth Integration

- **OAuth authentication flow**: Supports standard GitHub OAuth 2.0 flow
- **Secure state validation**: Uses random state parameter to prevent CSRF attacks
- **Repository management**:
  - Automatically syncs user's GitHub repository list
  - Supports public and private repositories
  - Locally caches repository information, reducing API calls
- **Token management**:
  - Securely stores access_token and refresh_token
  - Automatically detects token expiration and refreshes
  - Supports revoking tokens and disconnecting
- **Clone support**:
  - Generates HTTPS clone URL with OAuth token
  - Supports cloning private repositories directly in terminal
  - Temporary token URL, expires after use
- **User interface**:
  - Material-UI style management interface
  - Real-time display of connection status and user information
  - Supports searching and filtering repository list

### VS Code Remote-SSH Integration

- **SSHpiper proxy server**:
  - Uses SSHpiper as SSH proxy layer
  - Routes based on username to corresponding container
  - Single port (2222) serves all users
  - Supports dynamic configuration hot reload
- **workingDir driver mode**:
  - Uses filesystem configuration instead of YAML
  - Independent workingDir directory per user
  - Real-time sync between database and filesystem configuration
  - Supports authorized_keys and sshpiper_upstream files
- **SSH public key authentication**:
  - Only supports public key authentication, removed password authentication
  - Supports drag-and-drop upload of .pub files
  - Smart parsing of key file content and comments
  - Automatic extraction of key name (user@hostname)
  - Supports RSA, Ed25519, ECDSA formats
- **Multi-IDE support**:
  - One-click open for VS Code, Cursor, Windsurf
  - Uses respective URL schemes (vscode-remote://, cursor://, windsurf://)
  - Automatically generates SSH connection configuration
  - Simplified connection flow, no manual configuration needed

### Inlets Tunnel System

- **Tunnel server architecture**:
  - Uses Inlets OSS as tunnel server
  - Independent Docker container runs inlets server
  - Supports WebSocket control plane and HTTP data plane
  - Built-in status API tracks active tunnels
- **Container integration**:
  - Each development container pre-installed with inlets client
  - Simple `tunnel <port>` command creates tunnel
  - Auto-generates subdomain: `[container-id]-[port].tunnel.domain`
  - Supports HTTP/HTTPS protocols (OSS version limitation)
- **Tunnel management**:
  - Frontend real-time display of active tunnel list
  - Polls every 5 seconds to update tunnel status
  - Users only see their own container's tunnels
  - Click tunnel URL to open directly in new tab
- **Configuration system**:
  - All tunnel settings managed through dynamic configuration
  - Supports enabling/disabling tunnel feature
  - Configurable server URL, auth token, base domain
  - Production environment supports HTTPS and custom domains
- **Security considerations**:
  - Shared auth token, all containers use same token
  - Tunnels only expose specified ports, don't affect other container services
  - User isolation: can only view and manage own tunnels
  - Production environment enforces HTTPS

## Testing Strategy

- Unit test coverage > 80%
- Integration tests cover all APIs
- End-to-end tests cover critical user flows
- Automatically run regression tests on each commit

## Configuration Management

System configuration is managed through the dynamic configuration management system, supporting runtime updates without service restart.

### Dynamic Configuration Management

Use configuration management command line tool to manage runtime configuration:

```bash
# View all configurations
npm run config:list

# View detailed configuration (including descriptions)
npm run config:list -- -v

# Get specific configuration
npm run config:get max_output_buffer

# Set configuration value
npm run config:set max_output_buffer 10000
npm run config:set require_invite_code true -- -r "Enable invite-only registration"

# Reset to default value
npm run config:reset max_output_buffer

# View configuration change history
npm run config:history
npm run config:history max_output_buffer

# Export/import configuration
npm run config:export > config.json
npm run config:import config.json
```

### Configurable Items

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| max_output_buffer | number | 5000 | Maximum output chunks saved per session |
| max_output_buffer_mb | number | 5 | Maximum buffer size per session (MB) |
| reconnect_history_size | number | 500 | Number of history chunks sent on reconnection |
| session_timeout_hours | number | 24 | Session cleanup timeout (hours) |
| cleanup_interval_minutes | number | 60 | Cleanup task run interval (minutes) |
| container_memory_limit | string | 2g | Container memory limit |
| container_cpu_limit | number | 2 | Container CPU limit |
| require_invite_code | boolean | true | Whether invite code is required for registration |
| websocket_ping_interval | number | 30 | WebSocket ping interval (seconds) |
| websocket_ping_timeout | number | 60 | WebSocket ping timeout (seconds) |
| container_mode | boolean | true | Whether to enable container isolation mode |
| github_client_id | string | - | GitHub OAuth app Client ID |
| github_client_secret | string | - | GitHub OAuth app Client Secret |
| github_oauth_callback_url | string | - | GitHub OAuth callback URL |
| tunnels_enabled | boolean | false | Whether to enable tunnel feature |
| inlets_server_url | string | - | Inlets server WebSocket URL |
| inlets_status_api_url | string | - | Inlets server status API endpoint |
| inlets_shared_token | string | - | Shared auth token for all containers |
| tunnel_base_domain | string | - | Base domain for tunnel hostnames |

### Configuration Priority

For database-managed configuration items (set via config:set):
1. Database configuration value
2. Default value

For unmanaged configuration items:
1. Environment variable
2. Default value

Note: Once a configuration item is stored in the database, the corresponding environment variable will be ignored, ensuring configuration management consistency.

### Performance Optimization Notes

- **Dynamic updates**: Configuration changes take effect immediately without service restart
- **Caching mechanism**: Configuration cached in memory, reducing database queries
- **Audit logs**: All configuration changes have complete audit records
- **Type safety**: Automatic type conversion and validation

## Common Commands

```bash
# Initialize SSHpiper configuration (required for first run)
./scripts/setup-sshpiper.sh

# Development environment startup
# Backend (port 12021)
cd backend && pnpm run dev

# Frontend (port 12020)
cd frontend && pnpm start

# Docker environment startup (includes SSHpiper)
docker-compose up -d

# Rebuild container images (when updating Dockerfile)
docker-compose build

# Run tests
pnpm test

# Build production version
pnpm build

# Install dependencies
pnpm install

# Health check
curl http://localhost:12021/health

# Test SSHpiper configuration
./scripts/test-sshpiper-workingdir.sh

# Test SSH public key parsing feature
./scripts/test-ssh-key-parsing.sh

# Test SSH public key error handling
./scripts/test-ssh-key-error-handling.sh

# Test dockerode integration
node scripts/test-dockerode.js

# Test environment variable switching
node scripts/test-runtime-switch.js

# Invite code management commands
npm run invite:create -- --count 5       # Create 5 invite codes
npm run invite:list                      # View valid invite codes
npm run invite:list -- --all             # View all invite codes
npm run invite:delete <CODE>             # Delete invite code
npm run invite:disable <CODE>            # Disable invite code
npm run invite:stats                     # View statistics

# Tunnel feature setup
./scripts/setup-inlets.sh                 # Development environment setup
./scripts/setup-inlets.sh prod            # Production environment setup

# Test tunnel integration
./scripts/test-inlets-integration.sh      # Test tunnel feature

# Configure tunnel feature
npm run config:set tunnels_enabled true
npm run config:set inlets_server_url "ws://localhost:8090"
npm run config:set inlets_status_api_url "http://localhost:8091/status"
npm run config:set tunnel_base_domain "tunnel.localhost"
```

## Invite Code Registration Restriction System

### System Architecture

- **Command line management tool**:
  - Integrated into main program, uses commander.js to handle command line parameters
  - Create invite codes: supports batch, time validity, usage count, prefix options
  - View, delete, disable invite codes, usage statistics
  - No HTTP API exposure, ensuring security

### Database Design

- **invite_codes table**:
  - Stores invite code information and usage records
  - Supports expiration time, usage count limits
  - Records creator, user, usage time and other audit information
  - Index optimization for query performance

### Registration Flow Integration

- **Dynamic configuration control**: Enable via `npm run config:set require_invite_code true`
- **Frontend-backend sync**: Both frontend and backend validate, ensuring consistency
- **Transaction processing**: Database transactions ensure atomic operations
- **Error handling**: Detailed error feedback

### Production Environment Support

- **Docker**: `docker exec -it claude-web-backend npm run invite:create`
- **PM2**: `pm2 exec claude-web-backend -- npm run invite:create`
- **After compilation**: `node dist/server.js invite:create`
- **Remote execution**: Supports SSH remote management