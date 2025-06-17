import axios from "axios";
import { FastifyInstance } from "fastify";

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  clone_url: string;
  ssh_url: string;
  description?: string;
  updated_at: string;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
}

export class GitHubService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(private fastify: FastifyInstance) {
    this.clientId = process.env.GITHUB_CLIENT_ID || "";
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
    this.redirectUri = process.env.GITHUB_OAUTH_CALLBACK_URL || "";

    if (!this.clientId || !this.clientSecret) {
      this.fastify.log.warn("GitHub OAuth credentials not configured");
    }
  }

  getAuthorizationUrl(state: string): string {
    // GitHub OAuth Apps scopes - using minimal permissions
    // 'repo' scope includes:
    // - Full control of private/public repositories
    // - Read/write access to code, issues, pull requests, wikis, settings, webhooks, and services
    // - Read/write access to repository projects and invitations
    // This is the minimal scope that covers all your requirements
    const scope = "repo";

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scope,
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
    try {
      const response = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      this.fastify.log.error("Failed to exchange code for token:", error);
      throw new Error("Failed to authenticate with GitHub");
    }
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    try {
      const response = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      return response.data;
    } catch (error) {
      this.fastify.log.error("Failed to get GitHub user:", error);
      throw new Error("Failed to get GitHub user information");
    }
  }

  async getUserRepos(
    accessToken: string,
    page = 1,
    perPage = 100
  ): Promise<GitHubRepo[]> {
    try {
      const response = await axios.get("https://api.github.com/user/repos", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
        params: {
          page,
          per_page: perPage,
          sort: "updated",
          direction: "desc",
        },
      });

      return response.data;
    } catch (error) {
      this.fastify.log.error("Failed to get user repos:", error);
      throw new Error("Failed to get user repositories");
    }
  }

  async refreshToken(refreshToken: string): Promise<GitHubTokenResponse> {
    try {
      const response = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      this.fastify.log.error("Failed to refresh token:", error);
      throw new Error("Failed to refresh GitHub token");
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.delete(
        `https://api.github.com/applications/${this.clientId}/token`,
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
          data: {
            access_token: accessToken,
          },
        }
      );
    } catch (error) {
      this.fastify.log.error("Failed to revoke token:", error);
      throw new Error("Failed to revoke GitHub token");
    }
  }

  async saveConnection(
    userId: string,
    tokenData: GitHubTokenResponse
  ): Promise<void> {
    const { pool } = this.fastify.pg;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    await pool.query(
      `INSERT INTO github_connections (user_id, access_token, refresh_token, token_type, scope, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_type = EXCLUDED.token_type,
         scope = EXCLUDED.scope,
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        tokenData.access_token,
        tokenData.refresh_token,
        tokenData.token_type,
        tokenData.scope,
        expiresAt,
      ]
    );
  }

  async getConnection(userId: string): Promise<any> {
    const { pool } = this.fastify.pg;
    const result = await pool.query(
      "SELECT * FROM github_connections WHERE user_id = $1",
      [userId]
    );
    return result.rows[0];
  }

  async deleteConnection(userId: string): Promise<void> {
    const { pool } = this.fastify.pg;

    // Get the current connection to revoke the token
    const connection = await this.getConnection(userId);
    if (connection) {
      try {
        await this.revokeToken(connection.access_token);
      } catch (error) {
        this.fastify.log.warn(
          "Failed to revoke token on GitHub, continuing with local deletion"
        );
      }
    }

    // Delete all repos and connection
    await pool.query("DELETE FROM github_connections WHERE user_id = $1", [
      userId,
    ]);
  }

  async syncUserRepos(userId: string, accessToken: string): Promise<void> {
    const { pool } = this.fastify.pg;

    // Get connection ID
    const connResult = await pool.query(
      "SELECT id FROM github_connections WHERE user_id = $1",
      [userId]
    );

    if (!connResult.rows[0]) {
      throw new Error("GitHub connection not found");
    }

    const connectionId = connResult.rows[0].id;

    // Fetch repos from GitHub
    const repos = await this.getUserRepos(accessToken);

    // Sync repos to database
    for (const repo of repos) {
      await pool.query(
        `INSERT INTO github_repositories
         (user_id, github_connection_id, repo_id, repo_name, repo_full_name, repo_owner, is_private, clone_url, ssh_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, repo_id)
         DO UPDATE SET
           repo_name = EXCLUDED.repo_name,
           repo_full_name = EXCLUDED.repo_full_name,
           is_private = EXCLUDED.is_private,
           clone_url = EXCLUDED.clone_url,
           ssh_url = EXCLUDED.ssh_url,
           last_synced_at = CURRENT_TIMESTAMP`,
        [
          userId,
          connectionId,
          repo.id,
          repo.name,
          repo.full_name,
          repo.owner.login,
          repo.private,
          repo.clone_url,
          repo.ssh_url,
        ]
      );
    }
  }

  async getUserReposFromDb(userId: string): Promise<any[]> {
    const { pool } = this.fastify.pg;
    const result = await pool.query(
      "SELECT * FROM github_repositories WHERE user_id = $1 ORDER BY last_synced_at DESC",
      [userId]
    );
    return result.rows;
  }

  async deleteRepo(userId: string, repoId: string | number): Promise<void> {
    const { pool } = this.fastify.pg;
    await pool.query(
      "DELETE FROM github_repositories WHERE user_id = $1 AND repo_id = $2",
      [userId, repoId]
    );
  }

  async checkAndRefreshToken(userId: string): Promise<string> {
    const connection = await this.getConnection(userId);
    if (!connection) {
      throw new Error("No GitHub connection found");
    }

    // Check if token needs refresh (expires in less than 1 hour)
    if (connection.expires_at && connection.refresh_token) {
      const expiresAt = new Date(connection.expires_at);
      const oneHourFromNow = new Date(Date.now() + 3600 * 1000);

      if (expiresAt < oneHourFromNow) {
        try {
          const newTokenData = await this.refreshToken(
            connection.refresh_token
          );
          await this.saveConnection(userId, newTokenData);
          return newTokenData.access_token;
        } catch (error) {
          this.fastify.log.warn(
            "Failed to refresh token, using existing token"
          );
        }
      }
    }

    return connection.access_token;
  }
}
