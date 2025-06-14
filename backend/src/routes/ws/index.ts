import { FastifyInstance } from 'fastify';
import { ClaudeService } from '../../services/claude';
import { SessionManager } from '../../services/sessionManager';

export default async function (fastify: FastifyInstance) {
  // Get the singleton SessionManager instance
  const sessionManager = SessionManager.getInstance(fastify);
  const claudeService = new ClaudeService(fastify);
  
  // Store global session list WebSocket connections
  const sessionListConnections = new Set<any>();

  // WebSocket route for session list updates
  fastify.register(async function (fastify) {
    fastify.get('/sessions', { websocket: true }, async (connection, request) => {
      // Get token from query parameter
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      
      let user;
      if (token) {
        try {
          user = await fastify.jwt.verify(token);
        } catch (err) {
          fastify.log.error('Invalid JWT token for session list:', err);
        }
      }

      if (!user) {
        connection.socket.close(1008, 'Authentication required');
        return;
      }

      fastify.log.info(`Session list WebSocket connected for user ${user.id}`);
      
      // Add to global connections
      sessionListConnections.add(connection.socket);
      
      // Send initial session list
      const userSessions = sessionManager.getUserSessions(user.id);
      connection.socket.send(JSON.stringify({
        type: 'session_list',
        data: userSessions,
        timestamp: new Date()
      }));
      
      // Handle incoming messages
      connection.socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case 'get_sessions':
              const sessions = sessionManager.getUserSessions(user.id);
              connection.socket.send(JSON.stringify({
                type: 'session_list',
                data: sessions,
                timestamp: new Date()
              }));
              break;
              
            default:
              fastify.log.warn(`Unknown session list message type: ${data.type}`);
          }
        } catch (err) {
          fastify.log.error('Session list WebSocket message error:', err);
        }
      });
      
      // Cleanup on disconnect
      connection.socket.on('close', () => {
        fastify.log.info(`Session list WebSocket disconnected for user ${user.id}`);
        sessionListConnections.delete(connection.socket);
      });
    });
  });

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
        // Try to attach to existing session or restore from database
        let session = sessionManager.getSession(sessionId);
        fastify.log.info(`Looking for session ${sessionId}, found in memory: ${!!session}`);
        
        if (!session) {
          // Try to restore from database or create new session
          try {
            fastify.log.info(`Attempting to restore session ${sessionId} from database`);
            session = await sessionManager.attachToSession(sessionId, user.id);
            fastify.log.info(`Session ${sessionId} restored from database, buffer length: ${session.outputBuffer.length}`);
          } catch (err) {
            // Session not found in DB, create new one
            fastify.log.info(`Session ${sessionId} not found in DB, creating new session`);
            session = await sessionManager.createSession(user.id, { sessionId });
          }
        } else {
          // Session exists in memory, attach to it
          fastify.log.info(`Session ${sessionId} exists in memory, buffer length: ${session.outputBuffer.length}`);
          session = await sessionManager.attachToSession(sessionId, user.id);
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

        // Claude status change handler
        const onClaudeStatusChange = (processId: string, status: string) => {
          if (processId.startsWith(sessionId)) {
            connection.socket.send(JSON.stringify({
              type: 'claude_status',
              data: { status },
              timestamp: new Date()
            }));
          }
        };

        // Claude output handler
        const onClaudeOutput = (processId: string, output: string) => {
          if (processId.startsWith(sessionId)) {
            connection.socket.send(JSON.stringify({
              type: 'claude_output',
              data: output,
              timestamp: new Date()
            }));
          }
        };

        sessionManager.on('data', onData);
        sessionManager.on('command', onCommand);
        sessionManager.on('exit', onExit);
        claudeService.on('status_change', onClaudeStatusChange);
        claudeService.on('output', onClaudeOutput);

        // Handle incoming messages from client
        connection.socket.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
              case 'terminal_input':
                sessionManager.writeToSession(sessionId, data.data);
                break;
                
              case 'terminal_resize':
                sessionManager.resizeSession(sessionId, data.cols, data.rows);
                break;
                
              case 'get_history':
                const currentSession = sessionManager.getSession(sessionId);
                const history = currentSession ? currentSession.history : [];
                connection.socket.send(JSON.stringify({
                  type: 'command_history',
                  data: history,
                  timestamp: new Date()
                }));
                break;

              case 'claude_start':
                const claudeProcess = await claudeService.startClaude(user.id, sessionId, {
                  workingDir: data.workingDir || process.cwd(),
                  environment: data.environment || {},
                  args: data.args || [],
                  autoRestart: data.autoRestart !== false
                });
                
                connection.socket.send(JSON.stringify({
                  type: 'claude_status',
                  data: { status: claudeProcess.status },
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
          
          // Detach from session (decrements client count)
          sessionManager.detachFromSession(sessionId, user.id);
          
          // Remove event listeners
          sessionManager.off('data', onData);
          sessionManager.off('command', onCommand);
          sessionManager.off('exit', onExit);
          claudeService.off('status_change', onClaudeStatusChange);
          claudeService.off('output', onClaudeOutput);
        });

        // Send initial session info
        connection.socket.send(JSON.stringify({
          type: 'session_info',
          data: {
            sessionId: session.id,
            name: session.name,
            workingDir: session.workingDir,
            createdAt: session.createdAt,
            status: session.status,
            connectedClients: session.connectedClients
          },
          timestamp: new Date()
        }));

        // Send buffered output if session was restored
        if (session.outputBuffer.length > 0) {
          fastify.log.info(`Sending buffered output for session ${sessionId}, buffer length: ${session.outputBuffer.length}`);
          
          // Clear terminal first before sending history
          connection.socket.send(JSON.stringify({
            type: 'terminal_clear',
            timestamp: new Date()
          }));
          
          // Add small delay to ensure terminal is cleared
          setTimeout(() => {
            // Send history as a single block to preserve formatting
            const recentOutput = sessionManager.getSessionOutput(sessionId, 100); // Last 100 chunks
            const historyBlock = recentOutput.join(''); // Join without adding extra newlines
            
            fastify.log.info(`Sending history for session ${sessionId}, length: ${historyBlock.length}, first 100 chars: ${historyBlock.substring(0, 100)}`);
            
            if (historyBlock.trim()) {
              connection.socket.send(JSON.stringify({
                type: 'terminal_data',
                data: historyBlock,
                timestamp: new Date()
              }));
            } else {
              fastify.log.warn(`Session ${sessionId} has empty history block`);
            }
          }, 50);
        } else {
          fastify.log.info(`Session ${sessionId} has no buffered output`);
          // Send a welcome message to new terminal
          setTimeout(() => {
            connection.socket.send(JSON.stringify({
              type: 'terminal_data',
              data: '\x1b[1;32mWelcome to Claude Web Terminal!\x1b[0m\r\n'
            }));
            connection.socket.send(JSON.stringify({
              type: 'terminal_data',
              data: `Session: ${session.name || session.id}\r\n`
            }));
            connection.socket.send(JSON.stringify({
              type: 'terminal_data',
              data: 'Type commands to interact with the terminal.\r\n$ '
            }));
          }, 100);
        }

      } catch (err) {
        fastify.log.error('Terminal WebSocket error:', err);
        connection.socket.close(1011, 'Internal server error');
      }
    });
  });

  // Handle session list update events
  const broadcastSessionUpdate = (sessionInfo: any, eventType: string) => {
    const message = JSON.stringify({
      type: 'session_updated',
      data: { session: sessionInfo, eventType },
      timestamp: new Date()
    });
    
    fastify.log.info(`Broadcasting session update to ${sessionListConnections.size} connections:`, { 
      sessionId: sessionInfo.id, 
      eventType, 
      connectionCount: sessionListConnections.size 
    });
    
    // Broadcast to all session list connections
    const deadConnections = new Set();
    sessionListConnections.forEach(socket => {
      if (socket.readyState === 1) { // WebSocket.OPEN
        try {
          socket.send(message);
          fastify.log.info(`Sent session update to WebSocket connection`);
        } catch (error) {
          fastify.log.error('Failed to send message to WebSocket:', error);
          deadConnections.add(socket);
        }
      } else {
        fastify.log.warn(`Removing dead WebSocket connection (state: ${socket.readyState})`);
        deadConnections.add(socket);
      }
    });
    
    // Remove dead connections
    deadConnections.forEach(socket => {
      sessionListConnections.delete(socket);
    });
    
    fastify.log.info(`Active session list connections after cleanup: ${sessionListConnections.size}`);
  };
  
  const broadcastSessionDeleted = (sessionId: string) => {
    const message = JSON.stringify({
      type: 'session_deleted',
      data: { sessionId },
      timestamp: new Date()
    });
    
    // Broadcast to all session list connections
    sessionListConnections.forEach(socket => {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(message);
      }
    });
  };
  
  // Listen to session manager events
  sessionManager.on('session_created', (sessionInfo) => {
    broadcastSessionUpdate(sessionInfo, 'created');
  });
  
  sessionManager.on('session_updated', (sessionInfo) => {
    broadcastSessionUpdate(sessionInfo, 'updated');
  });
  
  sessionManager.on('session_deleted', (sessionId) => {
    broadcastSessionDeleted(sessionId);
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