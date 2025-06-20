import { EventEmitter } from 'events';

interface ConfigValue {
  key: string;
  value: string | null;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  defaultValue?: string;
}

interface ConfigCache {
  [key: string]: any;
}

export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager;
  private pool: any;
  private cache: ConfigCache = {};
  private cacheLoaded = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  private constructor(pool: any) {
    super();
    this.pool = pool;
  }

  static getInstance(pool: any): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(pool);
    }
    return ConfigManager.instance;
  }

  async initialize(refreshIntervalMs = 60000): Promise<void> {
    await this.loadCache();
    
    // Set up periodic refresh
    if (refreshIntervalMs > 0) {
      this.refreshInterval = setInterval(() => {
        this.loadCache().catch(console.error);
      }, refreshIntervalMs);
    }
  }

  async shutdown(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private async loadCache(): Promise<void> {
    try {
      const result = await this.pool.query('SELECT * FROM config_settings');
      const newCache: ConfigCache = {};

      for (const row of result.rows) {
        newCache[row.key] = this.parseValue(row.value || row.defaultValue, row.type);
      }

      // Check for changes and emit events
      if (this.cacheLoaded) {
        for (const key of Object.keys(newCache)) {
          if (this.cache[key] !== newCache[key]) {
            this.emit('configChanged', key, this.cache[key], newCache[key]);
          }
        }
      }

      this.cache = newCache;
      this.cacheLoaded = true;
    } catch (error) {
      console.error('Failed to load config cache:', error);
      throw error;
    }
  }

  private parseValue(value: string | null | undefined, type: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      default:
        return value;
    }
  }

  private stringifyValue(value: any, type: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'json':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    if (!this.cacheLoaded) {
      await this.loadCache();
    }

    // Check if this key is managed by the config system
    const isConfigManaged = await this.isConfigManaged(key);
    
    if (!isConfigManaged) {
      // For non-managed configs, still check environment variables
      const envKey = key.toUpperCase().replace(/\./g, '_');
      const envValue = process.env[envKey];
      
      if (envValue !== undefined) {
        const configType = await this.getConfigType(key);
        return this.parseValue(envValue, configType || 'string') as T;
      }
    }

    // Return from cache or default (ignore env vars for managed configs)
    const cacheValue = this.cache[key];
    const result = (cacheValue ?? defaultValue) as T;
    
    return result;
  }

  async set(key: string, value: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current value and type
      const currentResult = await client.query(
        'SELECT * FROM config_settings WHERE key = $1',
        [key]
      );

      let type = 'string';
      let oldValue: string | null = null;

      if (currentResult.rows.length > 0) {
        type = currentResult.rows[0]?.type || 'string';
        oldValue = currentResult.rows[0]?.value || null;
      } else {
        // Auto-detect type for new entries
        if (typeof value === 'boolean') type = 'boolean';
        else if (typeof value === 'number') type = 'number';
        else if (typeof value === 'object') type = 'json';
      }

      const newValue = this.stringifyValue(value, type);

      // Update or insert config
      await client.query(
        `INSERT INTO config_settings (key, value, type, updated_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE 
         SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [key, newValue, type]
      );


      await client.query('COMMIT');

      // Update cache
      this.cache[key] = value;
      this.emit('configChanged', key, this.parseValue(oldValue, type), value);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current value
      const currentResult = await client.query(
        'SELECT * FROM config_settings WHERE key = $1',
        [key]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Configuration key '${key}' not found`);
      }

      const oldValue = currentResult.rows[0]?.value || null;

      // Delete config
      await client.query('DELETE FROM config_settings WHERE key = $1', [key]);


      await client.query('COMMIT');

      // Update cache
      delete this.cache[key];
      this.emit('configChanged', key, this.parseValue(oldValue, currentResult.rows[0]?.type || 'string'), null);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(): Promise<ConfigValue[]> {
    const result = await this.pool.query(
      'SELECT * FROM config_settings ORDER BY key'
    );
    return result.rows;
  }


  private async getConfigType(key: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT type FROM config_settings WHERE key = $1',
      [key]
    );
    return result.rows.length > 0 ? result.rows[0]?.type || null : null;
  }

  private async isConfigManaged(key: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM config_settings WHERE key = $1',
      [key]
    );
    return result.rows.length > 0;
  }

  // Helper methods for common configurations
  async getMaxOutputBuffer(): Promise<number> {
    return this.get('max_output_buffer', 5000);
  }

  async getMaxOutputBufferMB(): Promise<number> {
    return this.get('max_output_buffer_mb', 5);
  }

  async getReconnectHistorySize(): Promise<number> {
    return this.get('reconnect_history_size', 500);
  }

  async getSessionTimeoutHours(): Promise<number> {
    return this.get('session_timeout_hours', 24);
  }

  async getCleanupIntervalMinutes(): Promise<number> {
    return this.get('cleanup_interval_minutes', 60);
  }

  async getRequireInviteCode(): Promise<boolean> {
    return this.get('require_invite_code', true);
  }

  async getContainerMemoryLimit(): Promise<string> {
    return this.get('container_memory_limit', '2g');
  }

  async getContainerCpuLimit(): Promise<number> {
    return this.get('container_cpu_limit', 2);
  }

  async getContainerMode(): Promise<boolean> {
    return this.get('container_mode', true);
  }

  async getGithubClientId(): Promise<string | null> {
    return this.get('github_client_id', null);
  }

  async getGithubClientSecret(): Promise<string | null> {
    return this.get('github_client_secret', null);
  }

  async getGithubOauthCallbackUrl(): Promise<string | null> {
    return this.get('github_oauth_callback_url', null);
  }

  async getWebsocketPingInterval(): Promise<number> {
    return this.get('websocket_ping_interval', 30);
  }

  async getWebsocketPingTimeout(): Promise<number> {
    return this.get('websocket_ping_timeout', 60);
  }

  // Get effective value with defaults for CLI display
  async getEffectiveValue(key: string): Promise<any> {
    switch (key) {
      case 'max_output_buffer':
        return this.getMaxOutputBuffer();
      case 'max_output_buffer_mb':
        return this.getMaxOutputBufferMB();
      case 'reconnect_history_size':
        return this.getReconnectHistorySize();
      case 'session_timeout_hours':
        return this.getSessionTimeoutHours();
      case 'cleanup_interval_minutes':
        return this.getCleanupIntervalMinutes();
      case 'require_invite_code':
        return this.getRequireInviteCode();
      case 'container_memory_limit':
        return this.getContainerMemoryLimit();
      case 'container_cpu_limit':
        return this.getContainerCpuLimit();
      case 'container_mode':
        return this.getContainerMode();
      case 'github_client_id':
        return this.getGithubClientId();
      case 'github_client_secret':
        return this.getGithubClientSecret();
      case 'github_oauth_callback_url':
        return this.getGithubOauthCallbackUrl();
      case 'websocket_ping_interval':
        return this.getWebsocketPingInterval();
      case 'websocket_ping_timeout':
        return this.getWebsocketPingTimeout();
      default:
        return this.get(key);
    }
  }
}