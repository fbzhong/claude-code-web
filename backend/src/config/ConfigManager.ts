import { Pool } from 'pg';
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
  private pool: Pool;
  private cache: ConfigCache = {};
  private cacheLoaded = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  private constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  static getInstance(pool: Pool): ConfigManager {
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
      const result = await this.pool.query<ConfigValue>('SELECT * FROM config_settings');
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

    const envKey = key.toUpperCase().replace(/\./g, '_');
    const envValue = process.env[envKey];

    // Environment variable takes precedence
    if (envValue !== undefined) {
      const configType = await this.getConfigType(key);
      return this.parseValue(envValue, configType || 'string') as T;
    }

    // Return from cache or default
    return (this.cache[key] !== undefined ? this.cache[key] : defaultValue) as T;
  }

  async set(key: string, value: any, changedBy = 'system', reason?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current value and type
      const currentResult = await client.query<ConfigValue>(
        'SELECT * FROM config_settings WHERE key = $1',
        [key]
      );

      let type = 'string';
      let oldValue: string | null = null;

      if (currentResult.rows.length > 0) {
        type = currentResult.rows[0].type;
        oldValue = currentResult.rows[0].value;
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

      // Log the change
      await client.query(
        `INSERT INTO config_audit_log (key, old_value, new_value, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [key, oldValue, newValue, changedBy, reason]
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

  async delete(key: string, changedBy = 'system', reason?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current value
      const currentResult = await client.query<ConfigValue>(
        'SELECT * FROM config_settings WHERE key = $1',
        [key]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Configuration key '${key}' not found`);
      }

      const oldValue = currentResult.rows[0].value;

      // Delete config
      await client.query('DELETE FROM config_settings WHERE key = $1', [key]);

      // Log the change
      await client.query(
        `INSERT INTO config_audit_log (key, old_value, new_value, changed_by, change_reason)
         VALUES ($1, $2, NULL, $3, $4)`,
        [key, oldValue, changedBy, reason]
      );

      await client.query('COMMIT');

      // Update cache
      delete this.cache[key];
      this.emit('configChanged', key, this.parseValue(oldValue, currentResult.rows[0].type), null);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(): Promise<ConfigValue[]> {
    const result = await this.pool.query<ConfigValue>(
      'SELECT * FROM config_settings ORDER BY key'
    );
    return result.rows;
  }

  async getAuditLog(key?: string, limit = 100): Promise<any[]> {
    let query = 'SELECT * FROM config_audit_log';
    const params: any[] = [];

    if (key) {
      query += ' WHERE key = $1';
      params.push(key);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  private async getConfigType(key: string): Promise<string | null> {
    const result = await this.pool.query<ConfigValue>(
      'SELECT type FROM config_settings WHERE key = $1',
      [key]
    );
    return result.rows.length > 0 ? result.rows[0].type : null;
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
    return this.get('require_invite_code', false);
  }

  async getContainerMemoryLimit(): Promise<string> {
    return this.get('container_memory_limit', '2g');
  }

  async getContainerCpuLimit(): Promise<number> {
    return this.get('container_cpu_limit', 2);
  }
}