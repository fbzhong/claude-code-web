import { FastifyInstance } from 'fastify';
import { program } from 'commander';
import { ConfigManager } from '../config/ConfigManager';
import Table from 'cli-table3';

export function setupConfigCommands(fastify: FastifyInstance): void {
  const configManager = ConfigManager.getInstance(fastify.pg);

  program
    .command('config:list')
    .description('List all configuration settings')
    .option('-v, --verbose', 'Show detailed information including descriptions')
    .action(async (options) => {
      try {
        await configManager.initialize(0); // No auto-refresh for CLI
        const configs = await configManager.list();

        if (configs.length === 0) {
          console.log('No configuration settings found');
          return;
        }

        if (options.verbose) {
          const table = new Table({
            head: ['Key', 'Value', 'Type', 'Default', 'Description'],
            colWidths: [30, 25, 10, 15, 40],
            wordWrap: true
          });

          for (const config of configs) {
            const currentValue = await configManager.getEffectiveValue(config.key);
            table.push([
              config.key,
              currentValue !== null && currentValue !== undefined ? String(currentValue) : '(not set)',
              config.type,
              config.defaultValue || '(none)',
              config.description || '(no description)'
            ]);
          }

          console.log(table.toString());
        } else {
          const table = new Table({
            head: ['Key', 'Value', 'Type'],
            colWidths: [35, 35, 15]
          });

          for (const config of configs) {
            const currentValue = await configManager.getEffectiveValue(config.key);
            table.push([
              config.key,
              currentValue !== null && currentValue !== undefined ? String(currentValue) : '(not set)',
              config.type
            ]);
          }

          console.log(table.toString());
        }
      } catch (error) {
        console.error('Error listing configurations:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });

  program
    .command('config:get <key>')
    .description('Get a configuration value')
    .action(async (key) => {
      try {
        await configManager.initialize(0);
        const value = await configManager.getEffectiveValue(key);
        
        if (value !== null && value !== undefined) {
          console.log(`${key}: ${JSON.stringify(value)}`);
        } else {
          console.log(`${key}: (not set)`);
          
          // Show default value if available
          const configs = await configManager.list();
          const config = configs.find(c => c.key === key);
          if (config && config.defaultValue) {
            console.log(`Default: ${config.defaultValue}`);
          }
        }
      } catch (error) {
        console.error('Error getting configuration:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });

  program
    .command('config:set <key> <value>')
    .description('Set a configuration value')
    .action(async (key, value, options) => {
      try {
        await configManager.initialize(0);
        
        // Parse value based on existing type or auto-detect
        let parsedValue: any = value;
        if (value.toLowerCase() === 'true') parsedValue = true;
        else if (value.toLowerCase() === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        else if (value.startsWith('{') || value.startsWith('[')) {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // Keep as string if JSON parsing fails
          }
        }

        await configManager.set(key, parsedValue);
        console.log(`Configuration '${key}' set to: ${JSON.stringify(parsedValue)}`);
      } catch (error) {
        console.error('Error setting configuration:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });

  program
    .command('config:reset <key>')
    .description('Reset a configuration to its default value')
    .action(async (key, options) => {
      try {
        await configManager.initialize(0);
        
        const configs = await configManager.list();
        const config = configs.find(c => c.key === key);
        
        if (!config) {
          console.error(`Configuration key '${key}' not found`);
          process.exit(1);
        }

        if (!config.defaultValue) {
          console.error(`Configuration key '${key}' has no default value`);
          process.exit(1);
        }

        await configManager.set(key, null);
        console.log(`Configuration '${key}' reset to default: ${config.defaultValue}`);
      } catch (error) {
        console.error('Error resetting configuration:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });

  program
    .command('config:delete <key>')
    .description('Delete a configuration setting')
    .action(async (key, options) => {
      try {
        await configManager.initialize(0);
        await configManager.delete(key);
        console.log(`Configuration '${key}' deleted successfully`);
      } catch (error) {
        console.error('Error deleting configuration:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });


  program
    .command('config:export')
    .description('Export all configurations as JSON')
    .action(async () => {
      try {
        await configManager.initialize(0);
        const configs = await configManager.list();
        const exportData: Record<string, any> = {};

        for (const config of configs) {
          const value = await configManager.get(config.key);
          exportData[config.key] = {
            value,
            type: config.type,
            description: config.description,
            defaultValue: config.defaultValue
          };
        }

        console.log(JSON.stringify(exportData, null, 2));
      } catch (error) {
        console.error('Error exporting configurations:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });

  program
    .command('config:import <file>')
    .description('Import configurations from JSON file')
    .action(async (file, options) => {
      try {
        await configManager.initialize(0);
        const fs = await import('fs/promises');
        const content = await fs.readFile(file, 'utf-8');
        const data = JSON.parse(content);

        let imported = 0;
        for (const [key, config] of Object.entries(data)) {
          if (typeof config === 'object' && config !== null && 'value' in config) {
            await configManager.set(key, config.value);
            imported++;
          }
        }

        console.log(`Successfully imported ${imported} configuration(s)`);
      } catch (error) {
        console.error('Error importing configurations:', error);
        process.exit(1);
      } finally {
        await configManager.shutdown();
      }
    });
}