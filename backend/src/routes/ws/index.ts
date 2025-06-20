import { FastifyInstance } from "fastify";
import { ClaudeService } from "../../services/claude";
import { SessionManager } from "../../services/sessionManager";
import { ConfigManager } from "../../config/ConfigManager";

export default async function (fastify: FastifyInstance) {
  // Get the singleton SessionManager instance
  const sessionManager = SessionManager.getInstance(fastify);
  const claudeService = new ClaudeService(fastify);

  // Store global session list WebSocket connections
  const sessionListConnections = new Set<any>();

  // WebSocket route for session list updates
  fastify.register(async function (fastify) {
    fastify.get(
      "/sessions",
      { websocket: true },
      async (connection, request) => {
        // Get token from query parameter
        const url = new URL(request.url, `http://${request.headers.host}`);
        const token = url.searchParams.get("token");

        let user;
        if (token) {
          try {
            user = await fastify.jwt.verify(token);
          } catch (err) {
            fastify.log.error("Invalid JWT token for session list:", err);
          }
        }

        if (!user) {
          connection.socket.close(1008, "Authentication required");
          return;
        }

        fastify.log.debug(
          `Session list WebSocket connected for user ${user.id}, current connections: ${sessionListConnections.size}`
        );

        // Add to global connections
        sessionListConnections.add(connection.socket);

        fastify.log.debug(
          `Session list connections after add: ${sessionListConnections.size}`
        );

        // Send initial session list
        const userSessions = sessionManager.getUserSessions(user.id);
        connection.socket.send(
          JSON.stringify({
            type: "session_list",
            data: userSessions,
            timestamp: new Date(),
          })
        );

        // Set up heartbeat for session list connection
        let heartbeatInterval: NodeJS.Timeout | null = null;
        let isAlive = true;
        
        const configManager = ConfigManager.getInstance(fastify.pg);
        const pingInterval = await configManager.getWebsocketPingInterval();
        
        fastify.log.debug(`Session list WebSocket ping interval: ${pingInterval}s`);

        heartbeatInterval = setInterval(() => {
          if (isAlive === false) {
            fastify.log.warn(
              `Session list WebSocket heartbeat failed for user ${user.id}, closing connection`
            );
            connection.socket.terminate();
            return;
          }

          isAlive = false;
          connection.socket.ping();
        }, pingInterval * 1000);

        connection.socket.on("pong", () => {
          isAlive = true;
        });

        // Handle incoming messages
        connection.socket.on("message", async (message) => {
          try {
            const data = JSON.parse(message.toString());

            switch (data.type) {
              case "get_sessions":
                const sessions = sessionManager.getUserSessions(user.id);
                connection.socket.send(
                  JSON.stringify({
                    type: "session_list",
                    data: sessions,
                    timestamp: new Date(),
                  })
                );
                break;

              case "ping":
                // Respond with pong
                connection.socket.send(
                  JSON.stringify({
                    type: "pong",
                    timestamp: new Date(),
                  })
                );
                break;

              case "pong":
                // Client responded to our ping
                break;

              default:
                fastify.log.debug(
                  `Unknown session list message type: ${data.type}`
                );
            }
          } catch (err) {
            fastify.log.error("Session list WebSocket message error:", err);
          }
        });

        // Cleanup on disconnect
        connection.socket.on("close", () => {
          fastify.log.debug(
            `Session list WebSocket disconnected for user ${user.id}, connections before delete: ${sessionListConnections.size}`
          );

          // Clear heartbeat interval
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }

          sessionListConnections.delete(connection.socket);

          fastify.log.debug(
            `Session list connections after delete: ${sessionListConnections.size}`
          );
        });
      }
    );
  });

  // WebSocket route for terminal connections
  fastify.register(async function (fastify) {
    fastify.get(
      "/terminal/:sessionId",
      { websocket: true },
      async (connection, request) => {
        const { sessionId } = request.params as { sessionId: string };

        // Get token and deviceId from query parameters
        const url = new URL(request.url, `http://${request.headers.host}`);
        const token = url.searchParams.get("token");
        const deviceId = url.searchParams.get("deviceId");

        let user;
        if (token) {
          try {
            user = await fastify.jwt.verify(token);
          } catch (err) {
            fastify.log.error("Invalid JWT token:", err);
          }
        }

        if (!user) {
          connection.socket.close(1008, "Authentication required");
          return;
        }

        fastify.log.debug(
          `Terminal WebSocket connected: ${sessionId} for user ${user.id} (device: ${deviceId})`
        );

        try {
          let session;

          // First, try to find the requested session by ID
          session = sessionManager.getSession(sessionId);
          fastify.log.debug(
            `Looking for requested session ${sessionId}, found in memory: ${!!session}`
          );

          if (session) {
            // Session exists, attach to it
            fastify.log.debug(
              `Session ${sessionId} exists in memory, buffer length: ${session.outputBuffer.length}`
            );
            session = await sessionManager.attachToSession(
              sessionId,
              user.id,
              deviceId || undefined
            );
          } else if (deviceId) {
            // Session not found, check if we have a session for this device
            fastify.log.debug(
              `Session ${sessionId} not found, checking device-based session for device ${deviceId}`
            );

            session = await sessionManager.getOrCreateSessionForDevice(
              user.id,
              deviceId
              // Don't specify name - let sessionManager generate a random animal name
            );

            // If the session ID doesn't match requested one, it means we're reusing an existing device session
            if (session.id !== sessionId) {
              fastify.log.debug(
                `Reusing existing device session ${session.id} for device ${deviceId} (requested: ${sessionId})`
              );
            }
          } else {
            // No device ID and session not found, create new one
            fastify.log.debug(
              `Session ${sessionId} not found and no device ID, creating new session`
            );
            session = await sessionManager.createSession(user.id, {
              sessionId,
            });
          }

          // Handle terminal data from PTY
          const onData = (sessionId: string, data: string) => {
            if (sessionId !== session!.id) return;

            connection.socket.send(
              JSON.stringify({
                type: "terminal_data",
                data: data,
                timestamp: new Date(),
                v: "1",
              })
            );
          };

          const onCommand = (sessionId: string, command: any) => {
            // PRIVACY: Command events are emitted for UI updates only
            // Commands are not stored persistently
            connection.socket.send(
              JSON.stringify({
                type: "command_history",
                data: command,
                timestamp: new Date(),
              })
            );
          };

          const onExit = (sessionId: string, exitCode: number) => {
            connection.socket.send(
              JSON.stringify({
                type: "terminal_exit",
                data: { exitCode },
                timestamp: new Date(),
              })
            );
            connection.socket.close(1000, "Terminal exited");
          };

          // Claude status change handler
          const onClaudeStatusChange = (processId: string, status: string) => {
            if (processId.startsWith(sessionId)) {
              connection.socket.send(
                JSON.stringify({
                  type: "claude_status",
                  data: { status },
                  timestamp: new Date(),
                })
              );
            }
          };

          // Claude output handler
          const onClaudeOutput = (processId: string, output: string) => {
            if (processId.startsWith(sessionId)) {
              connection.socket.send(
                JSON.stringify({
                  type: "claude_output",
                  data: output,
                  timestamp: new Date(),
                })
              );
            }
          };

          sessionManager.on("data", onData);
          sessionManager.on("command", onCommand);
          sessionManager.on("exit", onExit);
          claudeService.on("status_change", onClaudeStatusChange);
          claudeService.on("output", onClaudeOutput);

          // Handle incoming messages from client
          connection.socket.on("message", async (message) => {
            let data: any;
            try {
              data = JSON.parse(message.toString());

              switch (data.type) {
                case "terminal_input":
                  const inputData = data.data || "";
                  sessionManager.writeToSession(session.id, inputData);
                  break;

                case "terminal_resize":
                  sessionManager.resizeSession(
                    session.id,
                    data.cols,
                    data.rows
                  );
                  break;

                case "get_history":
                  const currentSession = sessionManager.getSession(session.id);
                  const history = currentSession ? currentSession.history : [];
                  connection.socket.send(
                    JSON.stringify({
                      type: "command_history",
                      data: history,
                      timestamp: new Date(),
                    })
                  );
                  break;

                case "claude_start":
                  const claudeProcess = await claudeService.startClaude(
                    user.id,
                    sessionId,
                    {
                      workingDir: data.workingDir || process.cwd(),
                      environment: data.environment || {},
                      args: data.args || [],
                      autoRestart: data.autoRestart !== false,
                    }
                  );

                  connection.socket.send(
                    JSON.stringify({
                      type: "claude_status",
                      data: { status: claudeProcess.status },
                      timestamp: new Date(),
                    })
                  );
                  break;

                case "claude_stop":
                  await claudeService.stopClaude(sessionId);
                  connection.socket.send(
                    JSON.stringify({
                      type: "claude_status",
                      data: { status: "stopped" },
                      timestamp: new Date(),
                    })
                  );
                  break;

                case "claude_restart":
                  const restartedProcess = await claudeService.restartClaude(
                    sessionId
                  );
                  connection.socket.send(
                    JSON.stringify({
                      type: "claude_status",
                      data: restartedProcess,
                      timestamp: new Date(),
                    })
                  );
                  break;

                case "ping":
                  // Respond with pong
                  connection.socket.send(
                    JSON.stringify({
                      type: "pong",
                      timestamp: new Date(),
                    })
                  );
                  break;

                case "pong":
                  // Client responded to our ping, connection is healthy
                  break;

                default:
                  fastify.log.debug(`Unknown message type: ${data.type}`);
              }
            } catch (err) {
              fastify.log.error("WebSocket message error:", {
                error: (err as any).message,
                stack: (err as any).stack,
                messageType: data?.type || "unknown",
              });
              connection.socket.send(
                JSON.stringify({
                  type: "error",
                  data: { message: "Invalid message format" },
                  timestamp: new Date(),
                })
              );
            }
          });

          // Set up heartbeat to detect stale connections
          let heartbeatInterval: NodeJS.Timeout | null = null;
          let isAlive = true;
          
          const configManager = ConfigManager.getInstance(fastify.pg);
          const pingInterval = await configManager.getWebsocketPingInterval();
          
          fastify.log.debug(`Terminal WebSocket ping interval: ${pingInterval}s`);

          // Send ping based on configuration
          heartbeatInterval = setInterval(() => {
            if (isAlive === false) {
              fastify.log.warn(
                `Terminal WebSocket heartbeat failed for session ${sessionId}, closing connection`
              );
              connection.socket.terminate();
              return;
            }

            isAlive = false;
            connection.socket.ping();
          }, pingInterval * 1000);

          // Handle pong responses
          connection.socket.on("pong", () => {
            isAlive = true;
          });

          // Cleanup on disconnect
          connection.socket.on("close", () => {
            fastify.log.debug(
              `Terminal WebSocket disconnected: ${session.id} (device: ${deviceId})`
            );

            // Clear heartbeat interval
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }

            // Detach from session (decrements client count and handles cleanup)
            sessionManager.detachFromSession(
              session.id,
              user.id,
              deviceId || undefined
            );

            // Remove event listeners
            sessionManager.off("data", onData);
            sessionManager.off("command", onCommand);
            sessionManager.off("exit", onExit);
            claudeService.off("status_change", onClaudeStatusChange);
            claudeService.off("output", onClaudeOutput);
          });

          // Send initial session info
          connection.socket.send(
            JSON.stringify({
              type: "session_info",
              data: {
                sessionId: session.id,
                name: session.name,
                workingDir: session.workingDir,
                createdAt: session.createdAt,
                status: session.status,
                connectedClients: session.connectedClients,
              },
              timestamp: new Date(),
            })
          );

          // Send buffered output if session was restored
          if (session.outputBuffer.length > 0) {
            fastify.log.debug(
              `Sending buffered output for session ${sessionId}, buffer length: ${session.outputBuffer.length}`
            );

            // Clear terminal first before sending history
            connection.socket.send(
              JSON.stringify({
                type: "terminal_clear",
                timestamp: new Date(),
              })
            );

            // Add small delay to ensure terminal is cleared
            setTimeout(() => {
              // Send history as a single block to preserve formatting
              // Use configurable reconnect history size from SessionManager
              const reconnectHistorySize =
                sessionManager.getReconnectHistorySize();
              const recentOutput = sessionManager.getSessionOutput(
                sessionId,
                reconnectHistorySize
              ); // Last N chunks based on config
              const historyBlock = recentOutput.join(""); // Join without adding extra newlines

              fastify.log.debug(
                `Sending history for session ${sessionId}, chunks: ${recentOutput.length}, ` +
                  `bytes: ${
                    historyBlock.length
                  }, first 100 chars: ${historyBlock.substring(0, 100)}`
              );

              if (historyBlock.trim()) {
                connection.socket.send(
                  JSON.stringify({
                    type: "terminal_data",
                    data: historyBlock,
                    timestamp: new Date(),
                  })
                );
              } else {
                fastify.log.debug(
                  `Session ${sessionId} has empty history block`
                );
              }
            }, 50);
          } else {
            fastify.log.debug(`Session ${sessionId} has no buffered output`);
          }
        } catch (err: any) {
          // Log error with full details
          fastify.log.error(`Terminal WebSocket error: ${err.message}`);
          fastify.log.error("Error details:", {
            message: err.message,
            stack: err.stack,
            code: err.code,
            name: err.name,
            sessionId: sessionId,
            userId: user?.id,
          });

          // Also use console.error as fallback to ensure we see the error
          console.error("Terminal WebSocket error full details:", err);

          connection.socket.close(1011, err.message || "Internal server error");
        }
      }
    );
  });

  // Handle session list update events
  const broadcastSessionUpdate = (sessionInfo: any, eventType: string) => {
    const message = JSON.stringify({
      type: "session_updated",
      data: { session: sessionInfo, eventType },
      timestamp: new Date(),
    });

    fastify.log.debug(
      `Broadcasting session update to ${sessionListConnections.size} connections:`,
      {
        sessionId: sessionInfo.id,
        eventType,
        connectionCount: sessionListConnections.size,
      }
    );

    // Broadcast to all session list connections
    const deadConnections = new Set();
    sessionListConnections.forEach((socket) => {
      if (socket.readyState === 1) {
        // WebSocket.OPEN
        try {
          socket.send(message);
          fastify.log.debug(`Sent session update to WebSocket connection`);
        } catch (error) {
          fastify.log.error("Failed to send message to WebSocket:", error);
          deadConnections.add(socket);
        }
      } else {
        fastify.log.debug(
          `Removing dead WebSocket connection (state: ${socket.readyState})`
        );
        deadConnections.add(socket);
      }
    });

    // Remove dead connections
    deadConnections.forEach((socket) => {
      sessionListConnections.delete(socket);
    });

    fastify.log.debug(
      `Active session list connections after cleanup: ${sessionListConnections.size}`
    );
  };

  const broadcastSessionDeleted = (sessionId: string) => {
    const message = JSON.stringify({
      type: "session_deleted",
      data: { sessionId },
      timestamp: new Date(),
    });

    fastify.log.debug(
      `Broadcasting session_deleted to ${sessionListConnections.size} connections for session ${sessionId}`
    );

    // Broadcast to all session list connections
    sessionListConnections.forEach((socket) => {
      if (socket.readyState === 1) {
        // WebSocket.OPEN
        socket.send(message);
        fastify.log.debug(
          `Sent session_deleted message to a WebSocket connection`
        );
      }
    });
  };

  // Listen to session manager events
  sessionManager.on("session_created", (sessionInfo) => {
    fastify.log.debug(`SessionManager emitted session_created event`);
    broadcastSessionUpdate(sessionInfo, "created");
  });

  sessionManager.on("session_updated", (sessionInfo) => {
    fastify.log.debug(`SessionManager emitted session_updated event`);
    broadcastSessionUpdate(sessionInfo, "updated");
  });

  sessionManager.on("session_deleted", (sessionId) => {
    fastify.log.debug(
      `SessionManager emitted session_deleted event for ${sessionId}`
    );
    broadcastSessionDeleted(sessionId);
  });

  // Handle Claude Code events
  claudeService.on("started", (sessionId, process) => {
    // Broadcast to relevant WebSocket connections
    fastify.log.debug(`Claude Code started for session ${sessionId}`);
  });

  claudeService.on("error", (sessionId, error) => {
    fastify.log.error(`Claude Code error for session ${sessionId}:`, error);
  });

  claudeService.on("exit", (sessionId, code) => {
    fastify.log.debug(
      `Claude Code exited for session ${sessionId} with code ${code}`
    );
  });

  // Cleanup on server shutdown
  fastify.addHook("onClose", async () => {
    await claudeService.cleanup();
  });
}
