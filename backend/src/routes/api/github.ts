import { FastifyPluginAsync } from 'fastify';
import { GitHubService } from '../../services/github';
import crypto from 'crypto';

const githubRoutes: FastifyPluginAsync = async (fastify) => {
  const githubService = new GitHubService(fastify);

  // Initiate GitHub OAuth flow
  fastify.get('/connect', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state in session (you might want to use Redis for this)
    request.session.set(`github_oauth_state_${request.user.id}`, state);
    
    const authUrl = githubService.getAuthorizationUrl(state);
    
    return reply.send({ authUrl });
  });

  // GitHub OAuth callback
  fastify.get<{
    Querystring: { code: string; state: string }
  }>('/callback', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { code, state } = request.query;
    
    // Verify state
    const storedState = await request.session.get(`github_oauth_state_${request.user.id}`);
    if (!storedState || storedState !== state) {
      return reply.code(400).send({ error: 'Invalid state parameter' });
    }
    
    // Clear state from session
    await request.session.del(`github_oauth_state_${request.user.id}`);
    
    try {
      // Exchange code for token
      const tokenData = await githubService.exchangeCodeForToken(code);
      
      // Save connection to database
      await githubService.saveConnection(request.user.id, tokenData);
      
      // Get user info from GitHub
      const githubUser = await githubService.getUser(tokenData.access_token);
      
      // Sync repos
      await githubService.syncUserRepos(request.user.id, tokenData.access_token);
      
      return reply.send({
        success: true,
        github_user: githubUser
      });
    } catch (error) {
      fastify.log.error('GitHub OAuth callback error:', error);
      return reply.code(500).send({ error: 'Failed to complete GitHub authentication' });
    }
  });

  // Get current GitHub connection status
  fastify.get('/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const connection = await githubService.getConnection(request.user.id);
      const isConnected = !!connection;
      
      let githubUser = null;
      if (isConnected) {
        try {
          const accessToken = await githubService.checkAndRefreshToken(request.user.id);
          githubUser = await githubService.getUser(accessToken);
        } catch (error) {
          fastify.log.warn('Failed to get GitHub user info:', error);
        }
      }
      
      return reply.send({
        connected: isConnected,
        github_user: githubUser,
        connected_at: connection?.created_at
      });
    } catch (error) {
      fastify.log.error('Failed to get GitHub status:', error);
      return reply.code(500).send({ error: 'Failed to get GitHub connection status' });
    }
  });

  // Get user's GitHub repositories
  fastify.get('/repos', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Get repos from database
      const repos = await githubService.getUserReposFromDb(request.user.id);
      
      return reply.send({ repos });
    } catch (error) {
      fastify.log.error('Failed to get repos:', error);
      return reply.code(500).send({ error: 'Failed to get repositories' });
    }
  });

  // Sync repositories from GitHub
  fastify.post('/repos/sync', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const accessToken = await githubService.checkAndRefreshToken(request.user.id);
      await githubService.syncUserRepos(request.user.id, accessToken);
      
      const repos = await githubService.getUserReposFromDb(request.user.id);
      
      return reply.send({ 
        success: true,
        repos 
      });
    } catch (error) {
      fastify.log.error('Failed to sync repos:', error);
      return reply.code(500).send({ error: 'Failed to sync repositories' });
    }
  });

  // Delete a specific repository (remove from local database only)
  fastify.delete<{
    Params: { repoId: string }
  }>('/repos/:repoId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const repoId = request.params.repoId;
      await githubService.deleteRepo(request.user.id, repoId);
      
      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to delete repo:', error);
      return reply.code(500).send({ error: 'Failed to delete repository' });
    }
  });

  // Disconnect GitHub (revoke token and delete all data)
  fastify.delete('/disconnect', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      await githubService.deleteConnection(request.user.id);
      
      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to disconnect GitHub:', error);
      return reply.code(500).send({ error: 'Failed to disconnect GitHub' });
    }
  });

  // Get repository access token for cloning
  fastify.get<{
    Params: { repoId: string }
  }>('/repos/:repoId/token', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const repoId = request.params.repoId;
      
      fastify.log.info('Getting token for repo:', { repoId, userId: request.user.id });
      
      // Verify user owns this repo
      const repos = await githubService.getUserReposFromDb(request.user.id);
      
      // Debug: log the first few repos to see the actual data structure
      if (repos.length > 0) {
        fastify.log.info('Sample repo data:', {
          firstRepo: repos[0],
          repoIdType: typeof repos[0].repo_id,
          searchingFor: repoId,
          searchingForType: typeof repoId
        });
      }
      
      // Compare as strings since PostgreSQL BIGINT may return as string
      const repo = repos.find(r => String(r.repo_id) === String(repoId));
      
      fastify.log.info('Found repos:', { count: repos.length, repoFound: !!repo });
      
      if (!repo) {
        return reply.code(404).send({ error: 'Repository not found' });
      }
      
      // Get fresh token
      const accessToken = await githubService.checkAndRefreshToken(request.user.id);
      
      // Return clone URLs with embedded token
      const httpsUrl = repo.clone_url.replace('https://', `https://oauth2:${accessToken}@`);
      
      return reply.send({
        repo_name: repo.repo_full_name,
        clone_url: httpsUrl,
        ssh_url: repo.ssh_url,
        is_private: repo.is_private
      });
    } catch (error) {
      fastify.log.error('Failed to get repo token:', error);
      return reply.code(500).send({ error: 'Failed to get repository token' });
    }
  });
};

export default githubRoutes;