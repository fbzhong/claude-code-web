import { FastifyInstance } from 'fastify';
import { TerminalService } from '../../services/terminal';
import { ClaudeService } from '../../services/claude';

export default async function (fastify: FastifyInstance) {
  const terminalService = new TerminalService(fastify);
  const claudeService = new ClaudeService(fastify);

  // WebSocket route for terminal connections
  fastify.register(async function (fastify) {
    fastify.get('/terminal/:sessionId', { websocket: true }, async (connection, request) => {
      const { sessionId } = request.params as { sessionId: string };
      
      // Get token from query parameter
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      
      let user;
      if (token) {
        try {
          user = await fastify.jwt.verify(token);
        } catch (err) {
          fastify.log.error('Invalid JWT token:', err);
        }
      }

      if (!user) {
        connection.socket.close(1008, 'Authentication required');
        return;
      }

      fastify.log.info(`Terminal WebSocket connected: ${sessionId} for user ${user.id}`);

      try {
        // Create or get existing terminal session
        let session = terminalService.getSession(sessionId);
        if (!session) {
          session = await terminalService.createSession(user.id, sessionId);
        }

        // Handle terminal data from PTY
        const onData = (sessionId: string, data: string) => {
          if (sessionId !== session!.id) return;
          connection.socket.send(JSON.stringify({
            type: 'terminal_data',
            data: data,
            timestamp: new Date()
          }));
        };

        const onCommand = (sessionId: string, command: any) => {
          connection.socket.send(JSON.stringify({
            type: 'command_history',
            data: command,
            timestamp: new Date()
          }));
        };

        const onExit = (sessionId: string, exitCode: number) => {
          connection.socket.send(JSON.stringify({
            type: 'terminal_exit',
            data: { exitCode },
            timestamp: new Date()
          }));
          connection.socket.close(1000, 'Terminal exited');
        };

        terminalService.on('data', onData);
        terminalService.on('command', onCommand);
        terminalService.on('exit', onExit);

        // Handle incoming messages from client
        connection.socket.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
              case 'terminal_input':
                terminalService.writeToSession(sessionId, data.data);
                break;
                
              case 'terminal_resize':
                terminalService.resizeSession(sessionId, data.cols, data.rows);
                break;
                
              case 'get_history':
                const history = await terminalService.getSessionHistory(sessionId);
                connection.socket.send(JSON.stringify({
                  type: 'command_history',
                  data: history,
                  timestamp: new Date()
                }));
                break;

              case 'claude_start':
                const claudeProcess = await claudeService.startClaude(sessionId, {
                  workingDir: data.workingDir || process.cwd(),
                  environment: data.environment || {},
                  args: data.args || [],
                  autoRestart: data.autoRestart !== false
                });
                
                connection.socket.send(JSON.stringify({
                  type: 'claude_status',
                  data: claudeProcess,
                  timestamp: new Date()
                }));
                break;

              case 'claude_stop':
                await claudeService.stopClaude(sessionId);
                connection.socket.send(JSON.stringify({
                  type: 'claude_status',
                  data: { status: 'stopped' },
                  timestamp: new Date()
                }));
                break;

              case 'claude_restart':
                const restartedProcess = await claudeService.restartClaude(sessionId);
                connection.socket.send(JSON.stringify({
                  type: 'claude_status',
                  data: restartedProcess,
                  timestamp: new Date()
                }));
                break;

              default:
                fastify.log.warn(`Unknown message type: ${data.type}`);
            }
          } catch (err) {
            fastify.log.error('WebSocket message error:', err);
            connection.socket.send(JSON.stringify({
              type: 'error',
              data: { message: 'Invalid message format' },
              timestamp: new Date()
            }));
          }
        });

        // Cleanup on disconnect
        connection.socket.on('close', () => {
          fastify.log.info(`Terminal WebSocket disconnected: ${sessionId}`);
          terminalService.off('data', onData);
          terminalService.off('command', onCommand);
          terminalService.off('exit', onExit);
        });

        // Send initial session info
        connection.socket.send(JSON.stringify({
          type: 'session_info',
          data: {
            sessionId: session.id,
            workingDir: session.workingDir,
            createdAt: session.createdAt
          },
          timestamp: new Date()
        }));

        // Send a welcome message to the terminal
        setTimeout(() => {
          connection.socket.send(JSON.stringify({
            type: 'terminal_data',
            data: '\x1b[1;32mWelcome to Claude Web Terminal!\x1b[0m\r\n'
          }));
          connection.socket.send(JSON.stringify({
            type: 'terminal_data',
            data: 'Type commands to interact with the terminal.\r\n$ '
          }));
        }, 100);

      } catch (err) {
        fastify.log.error('Terminal WebSocket error:', err);
        connection.socket.close(1011, 'Internal server error');
      }
    });
  });

  // Handle Claude Code events
  claudeService.on('started', (sessionId, process) => {
    // Broadcast to relevant WebSocket connections
    fastify.log.info(`Claude Code started for session ${sessionId}`);
  });

  claudeService.on('error', (sessionId, error) => {
    fastify.log.error(`Claude Code error for session ${sessionId}:`, error);
  });

  claudeService.on('exit', (sessionId, code) => {
    fastify.log.info(`Claude Code exited for session ${sessionId} with code ${code}`);
  });

  // Cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    await claudeService.cleanup();
  });
}