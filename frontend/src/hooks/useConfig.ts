import { useState, useEffect } from 'react';

interface ServerConfig {
  features: {
    github_oauth: {
      enabled: boolean;
      client_id_configured: boolean;
      client_secret_configured: boolean;
      callback_url_configured: boolean;
    };
    ssh: {
      enabled: boolean;
      host: string | null;
      port: number | null;
      sshpiper_configured: boolean;
    };
    container_mode: {
      enabled: boolean;
      docker_available: boolean;
    };
    authentication: {
      jwt_secret_configured: boolean;
      invite_code_required: boolean;
    };
  };
  environment: string;
}

const defaultConfig: ServerConfig = {
  features: {
    github_oauth: {
      enabled: false,
      client_id_configured: false,
      client_secret_configured: false,
      callback_url_configured: false,
    },
    ssh: {
      enabled: false,
      host: null,
      port: null,
      sshpiper_configured: false,
    },
    container_mode: {
      enabled: false,
      docker_available: false,
    },
    authentication: {
      jwt_secret_configured: false,
      invite_code_required: false,
    },
  },
  environment: 'development',
};

export const useConfig = () => {
  const [config, setConfig] = useState<ServerConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`);
        }
        
        const configData: ServerConfig = await response.json();
        setConfig(configData);
      } catch (err) {
        console.error('Failed to fetch server config:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch config');
        // Keep default config on error
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Re-run the effect
      window.location.reload();
    },
  };
};

// Hook to get just the invite code requirement
export const useRequireInviteCode = () => {
  const { config, loading, error } = useConfig();
  
  return {
    requireInviteCode: config.features.authentication.invite_code_required,
    loading,
    error,
  };
};