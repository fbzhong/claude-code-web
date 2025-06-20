import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { GitHubService } from "../../services/github";
import crypto from "crypto";

// Helper type for user object
interface UserPayload {
  id: string;
  email: string;
  role: string;
}

// In-memory store for OAuth states (in production, use Redis or database)
const oauthStates = new Map<string, string>();

const githubRoutes: FastifyPluginAsync = async (fastify) => {
  const githubService = new GitHubService(fastify);

  // Initiate GitHub OAuth flow
  fastify.get(
    "/connect",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Generate random state for CSRF protection
      const state = crypto.randomBytes(16).toString("hex");

      // Store state in memory (you might want to use Redis for this in production)
      // User is guaranteed to exist after authenticate middleware
      const user = request.user as UserPayload;
      oauthStates.set(`github_oauth_state_${user.id}`, state);

      const authUrl = await githubService.getAuthorizationUrl(state);

      return reply.send({ authUrl });
    }
  );

  // GitHub OAuth callback
  fastify.get<{
    Querystring: { code: string; state: string };
  }>(
    "/callback",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Querystring: { code: string; state: string } }>, reply: FastifyReply) => {
      const { code, state } = request.query;

      // User is guaranteed to exist after authenticate middleware
      const user = request.user as UserPayload;

      // Verify state
      const storedState = oauthStates.get(
        `github_oauth_state_${user.id}`
      );
      if (!storedState || storedState !== state) {
        return reply.code(400).send({ error: "Invalid state parameter" });
      }

      // Clear state from memory
      oauthStates.delete(`github_oauth_state_${user.id}`);

      try {
        // Exchange code for token
        const tokenData = await githubService.exchangeCodeForToken(code);

        // Save connection to database
        await githubService.saveConnection(user.id, tokenData);

        // Get user info from GitHub
        const githubUser = await githubService.getUser(tokenData.access_token);

        // Sync repos
        await githubService.syncUserRepos(
          user.id,
          tokenData.access_token
        );

        return reply.send({
          success: true,
          github_user: githubUser,
        });
      } catch (error) {
        fastify.log.error("GitHub OAuth callback error:", error);
        return reply
          .code(500)
          .send({ error: "Failed to complete GitHub authentication" });
      }
    }
  );

  // Get current GitHub connection status
  fastify.get(
    "/status",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // User is guaranteed to exist after authenticate middleware
        const user = request.user as UserPayload;

        const connection = await githubService.getConnection(user.id);
        const isConnected = !!connection;

        let githubUser = null;
        if (isConnected) {
          try {
            const accessToken = await githubService.checkAndRefreshToken(
              user.id
            );
            githubUser = await githubService.getUser(accessToken);
          } catch (error) {
            fastify.log.warn("Failed to get GitHub user info:", error);
          }
        }

        return reply.send({
          connected: isConnected,
          github_user: githubUser,
          connected_at: connection?.created_at,
        });
      } catch (error) {
        fastify.log.error("Failed to get GitHub status:", error);
        return reply
          .code(500)
          .send({ error: "Failed to get GitHub connection status" });
      }
    }
  );

  // Get user's GitHub repositories
  fastify.get(
    "/repos",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // User is guaranteed to exist after authenticate middleware
        const user = request.user as UserPayload;

        // Get repos from database
        const repos = await githubService.getUserReposFromDb(user.id);

        return reply.send({ repos });
      } catch (error) {
        fastify.log.error("Failed to get repos:", error);
        return reply.code(500).send({ error: "Failed to get repositories" });
      }
    }
  );

  // Sync repositories from GitHub
  fastify.post(
    "/repos/sync",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // User is guaranteed to exist after authenticate middleware
        const user = request.user as UserPayload;

        const accessToken = await githubService.checkAndRefreshToken(
          user.id
        );
        await githubService.syncUserRepos(user.id, accessToken);

        const repos = await githubService.getUserReposFromDb(user.id);

        return reply.send({
          success: true,
          repos,
        });
      } catch (error) {
        fastify.log.error("Failed to sync repos:", error);
        return reply.code(500).send({ error: "Failed to sync repositories" });
      }
    }
  );

  // Delete a specific repository (remove from local database only)
  fastify.delete<{
    Params: { repoId: string };
  }>(
    "/repos/:repoId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Params: { repoId: string } }>, reply: FastifyReply) => {
      try {
        // User is guaranteed to exist after authenticate middleware
        const user = request.user as UserPayload;

        const { repoId } = request.params;
        await githubService.deleteRepo(user.id, repoId);

        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error("Failed to delete repo:", error);
        return reply.code(500).send({ error: "Failed to delete repository" });
      }
    }
  );

  // Disconnect GitHub (revoke token and delete all data)
  fastify.delete(
    "/disconnect",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // User is guaranteed to exist after authenticate middleware
        const user = request.user as UserPayload;

        await githubService.deleteConnection(user.id);

        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error("Failed to disconnect GitHub:", error);
        return reply.code(500).send({ error: "Failed to disconnect GitHub" });
      }
    }
  );

  // Get repository access token for cloning
  fastify.get<{
    Params: { repoId: string };
  }>(
    "/repos/:repoId/token",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Params: { repoId: string } }>, reply: FastifyReply) => {
      try {
        // User is guaranteed to exist after authenticate middleware
        const user = request.user as UserPayload;

        const { repoId } = request.params;

        fastify.log.info("Getting token for repo:", {
          repoId,
          userId: user.id,
        });

        // Verify user owns this repo
        const repos = await githubService.getUserReposFromDb(user.id);

        // Debug: log the first few repos to see the actual data structure
        if (repos.length > 0) {
          fastify.log.info("Sample repo data:", {
            firstRepo: repos[0],
            repoIdType: typeof repos[0].repo_id,
            searchingFor: repoId,
            searchingForType: typeof repoId,
          });
        }

        // Compare as strings since PostgreSQL BIGINT may return as string
        const repo = repos.find((r) => String(r.repo_id) === String(repoId));

        fastify.log.info("Found repos:", {
          count: repos.length,
          repoFound: !!repo,
        });

        if (!repo) {
          return reply.code(404).send({ error: "Repository not found" });
        }

        // Get fresh token
        const accessToken = await githubService.checkAndRefreshToken(
          user.id
        );

        // Return clone URLs with embedded token
        const httpsUrl = repo.clone_url.replace(
          "https://",
          `https://oauth2:${accessToken}@`
        );

        return reply.send({
          repo_name: repo.repo_full_name,
          clone_url: httpsUrl,
          ssh_url: repo.ssh_url,
          is_private: repo.is_private,
        });
      } catch (error) {
        fastify.log.error("Failed to get repo token:", error);
        return reply
          .code(500)
          .send({ error: "Failed to get repository token" });
      }
    }
  );
};

export default githubRoutes;
