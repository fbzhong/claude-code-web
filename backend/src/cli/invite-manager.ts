import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { program } from 'commander';

export class InviteCodeManager {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private generateCode(length: number = 8): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length)
      .toUpperCase();
  }

  async createInviteCodes(count: number = 1, options: {
    maxUses?: number;
    expiresInDays?: number;
    prefix?: string;
  } = {}): Promise<string[]> {
    const client = await this.fastify.pg.connect();
    const codes: string[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const code = options.prefix 
          ? `${options.prefix}-${this.generateCode(8)}`
          : this.generateCode(8);
        
        const expiresAt = options.expiresInDays
          ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
          : null;

        await client.query(`
          INSERT INTO invite_codes (code, max_uses, expires_at)
          VALUES ($1, $2, $3)
        `, [code, options.maxUses || 1, expiresAt]);

        codes.push(code);
      }

      return codes;
    } finally {
      client.release();
    }
  }

  async listInviteCodes(options: {
    showUsed?: boolean;
    showExpired?: boolean;
  } = {}): Promise<any[]> {
    const client = await this.fastify.pg.connect();

    try {
      let query = `
        SELECT 
          code,
          created_by,
          created_at,
          used_by,
          used_at,
          expires_at,
          max_uses,
          current_uses,
          is_active,
          CASE 
            WHEN used_by IS NOT NULL THEN 'used'
            WHEN expires_at < NOW() THEN 'expired'
            WHEN current_uses >= max_uses THEN 'exhausted'
            WHEN is_active = false THEN 'disabled'
            ELSE 'active'
          END as status
        FROM invite_codes
        WHERE 1=1
      `;

      const conditions: string[] = [];
      
      if (!options.showUsed) {
        conditions.push('used_by IS NULL');
      }
      
      if (!options.showExpired) {
        conditions.push('(expires_at IS NULL OR expires_at > NOW())');
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';

      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async deleteInviteCode(code: string): Promise<boolean> {
    const client = await this.fastify.pg.connect();

    try {
      const result = await client.query(`
        DELETE FROM invite_codes
        WHERE code = $1 AND used_by IS NULL
      `, [code]);

      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  async disableInviteCode(code: string): Promise<boolean> {
    const client = await this.fastify.pg.connect();

    try {
      const result = await client.query(`
        UPDATE invite_codes
        SET is_active = false
        WHERE code = $1
      `, [code]);

      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  async getStats(): Promise<any> {
    const client = await this.fastify.pg.connect();

    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN used_by IS NULL AND is_active = true AND (expires_at IS NULL OR expires_at > NOW()) AND current_uses < max_uses THEN 1 END) as active,
          COUNT(CASE WHEN used_by IS NOT NULL OR current_uses >= max_uses THEN 1 END) as used,
          COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired,
          COUNT(CASE WHEN is_active = false THEN 1 END) as disabled
        FROM invite_codes
      `);

      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

export function setupInviteCommands(fastify: FastifyInstance): void {
  const inviteManager = new InviteCodeManager(fastify);

  program
    .command('invite:create')
    .description('Create new invite codes')
    .option('-c, --count <number>', 'Number of codes to create', '1')
    .option('-u, --max-uses <number>', 'Maximum uses per code', '1')
    .option('-e, --expires <days>', 'Expire after days')
    .option('-p, --prefix <prefix>', 'Code prefix')
    .action(async (options) => {
      try {
        const codes = await inviteManager.createInviteCodes(
          parseInt(options.count),
          {
            maxUses: parseInt(options.maxUses),
            expiresInDays: options.expires ? parseInt(options.expires) : undefined,
            prefix: options.prefix
          }
        );

        console.log('Created invite codes:');
        codes.forEach(code => console.log(`  ${code}`));
      } catch (error) {
        console.error('Error creating invite codes:', error);
        process.exit(1);
      }
    });

  program
    .command('invite:list')
    .description('List invite codes')
    .option('-a, --all', 'Show all codes including used and expired')
    .action(async (options) => {
      try {
        const codes = await inviteManager.listInviteCodes({
          showUsed: options.all,
          showExpired: options.all
        });

        if (codes.length === 0) {
          console.log('No invite codes found');
          return;
        }

        console.table(codes.map(code => ({
          Code: code.code,
          Status: code.status,
          Uses: `${code.current_uses}/${code.max_uses}`,
          'Created At': new Date(code.created_at).toLocaleString(),
          'Expires At': code.expires_at ? new Date(code.expires_at).toLocaleString() : 'Never'
        })));
      } catch (error) {
        console.error('Error listing invite codes:', error);
        process.exit(1);
      }
    });

  program
    .command('invite:delete <code>')
    .description('Delete an unused invite code')
    .action(async (code) => {
      try {
        const deleted = await inviteManager.deleteInviteCode(code);
        if (deleted) {
          console.log(`Invite code ${code} deleted successfully`);
        } else {
          console.log(`Invite code ${code} not found or already used`);
        }
      } catch (error) {
        console.error('Error deleting invite code:', error);
        process.exit(1);
      }
    });

  program
    .command('invite:disable <code>')
    .description('Disable an invite code')
    .action(async (code) => {
      try {
        const disabled = await inviteManager.disableInviteCode(code);
        if (disabled) {
          console.log(`Invite code ${code} disabled successfully`);
        } else {
          console.log(`Invite code ${code} not found`);
        }
      } catch (error) {
        console.error('Error disabling invite code:', error);
        process.exit(1);
      }
    });

  program
    .command('invite:stats')
    .description('Show invite code statistics')
    .action(async () => {
      try {
        const stats = await inviteManager.getStats();
        console.log('Invite Code Statistics:');
        console.log(`  Total: ${stats.total}`);
        console.log(`  Active: ${stats.active}`);
        console.log(`  Used: ${stats.used}`);
        console.log(`  Expired: ${stats.expired}`);
        console.log(`  Disabled: ${stats.disabled}`);
      } catch (error) {
        console.error('Error getting stats:', error);
        process.exit(1);
      }
    });
}