import { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { ConfigManager } from "../../config/ConfigManager";
import fetch from "node-fetch";

export default async function (fastify: FastifyInstance) {
  // Get tunnel configuration for containers
  fastify.get(
    "/config/tunnels",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const configManager = ConfigManager.getInstance(fastify.pg);
        
        // Check if tunnels are enabled
        const tunnelsEnabled = await configManager.getTunnelsEnabled();
        if (!tunnelsEnabled) {
          return reply.status(404).send({
            success: false,
            error: "Tunnels feature is not enabled",
          });
        }

        // Get tunnel configuration
        const [
          inletsServerUrl,
          inletsSharedToken,
          tunnelBaseDomain,
        ] = await Promise.all([
          configManager.getInletsServerUrl(),
          configManager.getInletsSharedToken(),
          configManager.getTunnelBaseDomain(),
        ]);

        // Validate configuration
        if (!inletsServerUrl || !inletsSharedToken || !tunnelBaseDomain) {
          return reply.status(503).send({
            success: false,
            error: "Tunnel service is not properly configured",
          });
        }

        return {
          success: true,
          data: {
            tunnels_enabled: true,
            inlets_server_url: inletsServerUrl,
            inlets_shared_token: inletsSharedToken,
            tunnel_base_domain: tunnelBaseDomain,
          },
        };
      } catch (err) {
        fastify.log.error("Error getting tunnel config:", err);
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // List active tunnels for current user
  fastify.get(
    "/tunnels",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              tunnels: Type.Array(
                Type.Object({
                  hostname: Type.String(),
                  public_url: Type.String(),
                  upstream: Type.String(),
                  client_id: Type.String(),
                  connected_at: Type.String(),
                  status: Type.String(),
                })
              ),
            }),
          }),
          503: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const configManager = ConfigManager.getInstance(fastify.pg);
        const user = (request as any).user;

        // Check if tunnels are enabled
        const tunnelsEnabled = await configManager.getTunnelsEnabled();
        if (!tunnelsEnabled) {
          return {
            success: true,
            data: {
              tunnels: [],
            },
          };
        }

        // Get inlets status API URL
        const inletsStatusApiUrl = await configManager.getInletsStatusApiUrl();
        if (!inletsStatusApiUrl) {
          return reply.status(503).send({
            success: false,
            error: "Tunnel service is not properly configured",
          });
        }

        // Get user's container IDs
        const containerMode = await configManager.getContainerMode();
        let userContainerIds: string[] = [];

        if (containerMode) {
          // In container mode, get user's container ID
          const containerName = `claude-web-user-${user.id}`;
          userContainerIds = [containerName];
        }

        // Fetch tunnel status from inlets server
        try {
          const response = await fetch(inletsStatusApiUrl, {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
            timeout: 5000,
          });

          if (!response.ok) {
            fastify.log.error(
              `Failed to fetch inlets status: ${response.status} ${response.statusText}`
            );
            return {
              success: true,
              data: {
                tunnels: [],
              },
            };
          }

          const allTunnels = (await response.json()) as any[];

          // Filter tunnels by user's containers
          const userTunnels = allTunnels.filter((tunnel) => {
            // Check if client_id matches any of user's container IDs
            return userContainerIds.some((containerId) =>
              tunnel.client_id?.includes(containerId)
            );
          });

          // Transform tunnel data
          const tunnels = userTunnels.map((tunnel) => ({
            hostname: tunnel.hostname || tunnel.domain || "",
            public_url: tunnel.public_url || `https://${tunnel.hostname || tunnel.domain}`,
            upstream: tunnel.upstream || "",
            client_id: tunnel.client_id || "",
            connected_at: tunnel.connected_at || new Date().toISOString(),
            status: "active",
          }));

          return {
            success: true,
            data: {
              tunnels,
            },
          };
        } catch (fetchError) {
          fastify.log.error("Error fetching from inlets server:", fetchError);
          return {
            success: true,
            data: {
              tunnels: [],
            },
          };
        }
      } catch (err) {
        fastify.log.error("Error listing tunnels:", err);
        return reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );
}