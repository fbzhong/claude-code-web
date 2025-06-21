import { test } from 'tap';
import { build } from '../test-helper';
import { FastifyInstance } from 'fastify';

test('tunnels routes', async (t) => {
  let app: FastifyInstance;

  t.beforeEach(async () => {
    app = await build(t);
  });

  t.afterEach(async () => {
    await app.close();
  });

  t.test('GET /api/config/tunnels - requires authentication', async (t) => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/tunnels',
    });

    t.equal(res.statusCode, 401);
  });

  t.test('GET /api/config/tunnels - returns 404 when tunnels disabled', async (t) => {
    // Create a test user and get token
    const token = await createTestUser(app);

    // Ensure tunnels are disabled
    const configManager = app.configManager;
    await configManager.set('tunnels_enabled', false);

    const res = await app.inject({
      method: 'GET',
      url: '/api/config/tunnels',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    t.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    t.equal(body.error, 'Tunnels feature is not enabled');
  });

  t.test('GET /api/config/tunnels - returns config when enabled', async (t) => {
    const token = await createTestUser(app);
    const configManager = app.configManager;

    // Set up tunnel configuration
    await configManager.set('tunnels_enabled', true);
    await configManager.set('inlets_server_url', 'wss://test.example.com');
    await configManager.set('inlets_shared_token', 'test-token');
    await configManager.set('tunnel_base_domain', 'tunnel.example.com');

    const res = await app.inject({
      method: 'GET',
      url: '/api/config/tunnels',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    t.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    t.ok(body.success);
    t.equal(body.data.tunnels_enabled, true);
    t.equal(body.data.inlets_server_url, 'wss://test.example.com');
    t.equal(body.data.inlets_shared_token, 'test-token');
    t.equal(body.data.tunnel_base_domain, 'tunnel.example.com');
  });

  t.test('GET /api/tunnels - requires authentication', async (t) => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tunnels',
    });

    t.equal(res.statusCode, 401);
  });

  t.test('GET /api/tunnels - returns empty list when tunnels disabled', async (t) => {
    const token = await createTestUser(app);
    const configManager = app.configManager;
    await configManager.set('tunnels_enabled', false);

    const res = await app.inject({
      method: 'GET',
      url: '/api/tunnels',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    t.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    t.ok(body.success);
    t.same(body.data.tunnels, []);
  });
});

// Helper function to create test user
async function createTestUser(app: FastifyInstance): Promise<string> {
  const email = `test-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email,
      password,
    },
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email,
      password,
    },
  });

  const loginBody = JSON.parse(loginRes.body);
  return loginBody.data.token;
}