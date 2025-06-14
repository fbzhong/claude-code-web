import { test } from 'tap';
import { build } from '../src/app';
import { FastifyInstance } from 'fastify';

test('session output buffer persistence', async (t) => {
  let fastify: FastifyInstance;
  let token: string;
  let sessionId: string;

  t.beforeEach(async () => {
    fastify = await build({ logger: false });
    
    // Register a test user
    const registerRes = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testuser',
        password: 'testpassword123',
        email: 'test@example.com'
      }
    });
    
    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'testuser',
        password: 'testpassword123'
      }
    });
    
    token = JSON.parse(loginRes.payload).token;
  });

  t.afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  t.test('should persist and restore session output buffer', async (t) => {
    // Create a session
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Test Session',
        workingDir: '/tmp'
      }
    });
    
    t.equal(createRes.statusCode, 201, 'Session created successfully');
    sessionId = JSON.parse(createRes.payload).id;
    
    // Get the session manager instance
    const sessionManager = (fastify as any).sessionManager;
    const session = sessionManager.getSession(sessionId);
    
    // Simulate some terminal output
    const testOutput = ['Hello World\\r\\n', 'This is a test\\r\\n', 'Output persistence\\r\\n'];
    for (const output of testOutput) {
      await sessionManager.addToOutputBuffer(sessionId, output);
    }
    
    // Wait a bit for async database write
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Remove session from memory to simulate server restart
    sessionManager.sessions.delete(sessionId);
    
    // Try to restore the session
    const restoredSession = await sessionManager.restoreSessionFromDb(sessionId, 'testuser');
    
    t.ok(restoredSession, 'Session restored successfully');
    t.equal(restoredSession.outputBuffer.length, testOutput.length, 'Output buffer restored with correct length');
    t.same(restoredSession.outputBuffer, testOutput, 'Output buffer content matches');
  });

  t.test('should limit output buffer size', async (t) => {
    // Create a session
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Test Session 2',
        workingDir: '/tmp'
      }
    });
    
    sessionId = JSON.parse(createRes.payload).id;
    const sessionManager = (fastify as any).sessionManager;
    
    // Add more output than the limit
    const maxOutputBuffer = sessionManager.maxOutputBuffer;
    for (let i = 0; i < maxOutputBuffer + 100; i++) {
      await sessionManager.addToOutputBuffer(sessionId, `Line ${i}\\r\\n`);
    }
    
    const session = sessionManager.getSession(sessionId);
    t.equal(session.outputBuffer.length, maxOutputBuffer, 'Output buffer limited to max size');
  });
});