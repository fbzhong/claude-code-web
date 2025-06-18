import { useState, useEffect } from 'react';
import githubApi from '../services/github';
import { sshApi } from '../services/api';

export interface IntegrationStatus {
  github: {
    enabled: boolean;
    connected: boolean;
    user?: {
      login: string;
      avatar_url?: string;
    };
  };
  ssh: {
    enabled: boolean;
    configured: boolean;
    hasKeys: boolean;
    keyCount: number;
  };
  container: {
    enabled: boolean;
    canRestart: boolean;
  };
}

export const useIntegrationStatus = () => {
  const [status, setStatus] = useState<IntegrationStatus>({
    github: {
      enabled: false,
      connected: false,
    },
    ssh: {
      enabled: false,
      configured: false,
      hasKeys: false,
      keyCount: 0,
    },
    container: {
      enabled: true, // Container is always available
      canRestart: true,
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check GitHub status
      let githubStatus: IntegrationStatus['github'] = { enabled: false, connected: false };
      try {
        const githubResponse = await githubApi.getStatus();
        githubStatus = {
          enabled: true,
          connected: githubResponse.connected,
          user: githubResponse.github_user,
        };
      } catch (err) {
        // GitHub integration might not be enabled on server
        console.log('GitHub integration not available:', err);
      }

      // Check SSH status
      let sshStatus = { enabled: false, configured: false, hasKeys: false, keyCount: 0 };
      try {
        const [sshInfo, sshKeys] = await Promise.all([
          sshApi.getSSHInfo(),
          sshApi.getSSHKeys(),
        ]);
        
        sshStatus = {
          enabled: true,
          configured: !!(sshInfo.username && sshInfo.host && sshInfo.port),
          hasKeys: sshKeys.length > 0,
          keyCount: sshKeys.length,
        };
      } catch (err) {
        // SSH might not be configured
        console.log('SSH not configured:', err);
      }

      setStatus({
        github: githubStatus,
        ssh: sshStatus,
        container: {
          enabled: true,
          canRestart: true,
        },
      });
    } catch (err) {
      console.error('Failed to fetch integration status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
  };
};