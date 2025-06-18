import { useState, useEffect } from 'react';
import githubApi from '../services/github';
import { sshApi } from '../services/api';
import { buildApiUrl } from '../config/api';

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
      enabled: false,
      canRestart: false,
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get server configuration first
      const configResponse = await fetch(buildApiUrl('/config'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!configResponse.ok) {
        throw new Error('Failed to fetch server configuration');
      }

      const serverConfig = await configResponse.json();

      // Check GitHub status - only if server has it configured
      let githubStatus: IntegrationStatus['github'] = { enabled: false, connected: false };
      if (serverConfig.features?.github_oauth?.enabled) {
        try {
          const githubResponse = await githubApi.getStatus();
          githubStatus = {
            enabled: true,
            connected: githubResponse.connected,
            user: githubResponse.github_user,
          };
        } catch (err) {
          // GitHub configured on server but user not connected
          githubStatus = { enabled: true, connected: false };
        }
      }

      // Check SSH status - only if server has it configured
      let sshStatus = { enabled: false, configured: false, hasKeys: false, keyCount: 0 };
      if (serverConfig.features?.ssh?.enabled) {
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
          // SSH enabled on server but user hasn't configured it
          sshStatus = { enabled: true, configured: false, hasKeys: false, keyCount: 0 };
        }
      }

      // Check container status - only if server has it enabled
      let containerStatus = { enabled: false, canRestart: false };
      if (serverConfig.features?.container_mode?.enabled) {
        containerStatus = {
          enabled: true,
          canRestart: !!serverConfig.features.container_mode.docker_available,
        };
      }

      setStatus({
        github: githubStatus,
        ssh: sshStatus,
        container: containerStatus,
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