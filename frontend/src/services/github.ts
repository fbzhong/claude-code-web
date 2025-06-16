import api from './api';

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export interface GitHubRepo {
  id: number;
  repo_id: number;
  repo_name: string;
  repo_full_name: string;
  repo_owner: string;
  is_private: boolean;
  clone_url: string;
  ssh_url: string;
  last_synced_at: string;
}

export interface GitHubStatus {
  connected: boolean;
  github_user?: GitHubUser;
  connected_at?: string;
}

export interface RepoToken {
  repo_name: string;
  clone_url: string;
  ssh_url: string;
  is_private: boolean;
}

class GitHubService {
  async connect(): Promise<{ authUrl: string }> {
    const response = await api.get('/api/github/connect');
    return response.data;
  }

  async handleCallback(code: string, state: string): Promise<{ success: boolean; github_user?: GitHubUser }> {
    const response = await api.get('/api/github/callback', {
      params: { code, state }
    });
    return response.data;
  }

  async getStatus(): Promise<GitHubStatus> {
    const response = await api.get('/api/github/status');
    return response.data;
  }

  async getRepos(): Promise<{ repos: GitHubRepo[] }> {
    const response = await api.get('/api/github/repos');
    return response.data;
  }

  async syncRepos(): Promise<{ success: boolean; repos: GitHubRepo[] }> {
    const response = await api.post('/api/github/repos/sync');
    return response.data;
  }

  async deleteRepo(repoId: number): Promise<{ success: boolean }> {
    const response = await api.delete(`/api/github/repos/${repoId}`);
    return response.data;
  }

  async disconnect(): Promise<{ success: boolean }> {
    const response = await api.delete('/api/github/disconnect');
    return response.data;
  }

  async getRepoToken(repoId: number): Promise<RepoToken> {
    const response = await api.get(`/api/github/repos/${repoId}/token`);
    return response.data;
  }
}

export default new GitHubService();