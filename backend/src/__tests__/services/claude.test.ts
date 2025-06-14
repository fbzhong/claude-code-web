import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ClaudeService } from '../../services/claude';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('ClaudeService', () => {
  let claudeService: ClaudeService;
  let mockFastify: any;
  let mockChildProcess: any;

  beforeEach(() => {
    mockChildProcess = {
      pid: 12345,
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      stdin: {
        write: jest.fn()
      },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false
    };

    mockFastify = {
      log: {
        info: jest.fn(),
        error: jest.fn()
      },
      pg: {
        connect: jest.fn().mockResolvedValue({
          query: jest.fn(),
          release: jest.fn()
        })
      }
    };

    const { spawn } = require('child_process');
    (spawn as jest.Mock).mockReturnValue(mockChildProcess);

    claudeService = new ClaudeService(mockFastify);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startClaude', () => {
    it('should start Claude Code process', async () => {
      const sessionId = 'session-123';
      const config = {
        workingDir: '/tmp',
        environment: { NODE_ENV: 'test' },
        args: ['--verbose'],
        autoRestart: true
      };

      // Mock successful executable check
      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      const processPromise = claudeService.startClaude(sessionId, config);

      // Simulate successful spawn
      const spawnCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'spawn')[1];
      spawnCallback();

      const process = await processPromise;

      expect(process).toMatchObject({
        sessionId: sessionId,
        pid: 12345,
        status: 'running',
        config: config
      });

      expect(process.id).toBeDefined();
      expect(process.startedAt).toBeInstanceOf(Date);
    });

    it('should handle process start error', async () => {
      const sessionId = 'session-123';
      const config = {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: false
      };

      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      const processPromise = claudeService.startClaude(sessionId, config);

      // Simulate process error
      const errorCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'error')[1];
      errorCallback(new Error('Process failed'));

      const process = await processPromise;

      expect(process.status).toBe('error');
      expect(mockFastify.log.error).toHaveBeenCalled();
    });

    it('should throw error if Claude executable not found', async () => {
      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockRejectedValue(new Error('Claude Code executable not found'));

      await expect(claudeService.startClaude('session-123', {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: false
      })).rejects.toThrow('Claude Code executable not found');
    });

    it('should auto-restart on non-zero exit when configured', async () => {
      const sessionId = 'session-123';
      const config = {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: true
      };

      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      const startClaudeSpy = jest.spyOn(claudeService, 'startClaude');

      await claudeService.startClaude(sessionId, config);

      // Simulate process exit with error
      const exitCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      exitCallback(1, null);

      // Wait for auto-restart timeout
      await new Promise(resolve => setTimeout(resolve, 5100));

      expect(startClaudeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopClaude', () => {
    beforeEach(async () => {
      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      await claudeService.startClaude('session-123', {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: false
      });

      // Simulate successful spawn
      const spawnCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'spawn')[1];
      spawnCallback();
    });

    it('should stop Claude Code process', async () => {
      const result = await claudeService.stopClaude('session-123');

      expect(result).toBe(true);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should return false for non-existent session', async () => {
      const result = await claudeService.stopClaude('non-existent');

      expect(result).toBe(false);
    });

    it('should force kill after timeout', async () => {
      jest.useFakeTimers();

      claudeService.stopClaude('session-123');

      // Fast-forward time
      jest.advanceTimersByTime(10000);

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');

      jest.useRealTimers();
    });
  });

  describe('restartClaude', () => {
    beforeEach(async () => {
      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      await claudeService.startClaude('session-123', {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: false
      });
    });

    it('should restart Claude Code process', async () => {
      const stopSpy = jest.spyOn(claudeService, 'stopClaude');
      const startSpy = jest.spyOn(claudeService, 'startClaude');

      const process = await claudeService.restartClaude('session-123');

      expect(stopSpy).toHaveBeenCalledWith('session-123');
      expect(startSpy).toHaveBeenCalledTimes(2); // Original start + restart
      expect(process).toBeDefined();
    });

    it('should return null for non-existent session', async () => {
      const process = await claudeService.restartClaude('non-existent');

      expect(process).toBeNull();
    });
  });

  describe('sendInput', () => {
    beforeEach(async () => {
      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      await claudeService.startClaude('session-123', {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: false
      });
    });

    it('should send input to Claude Code process', () => {
      const result = claudeService.sendInput('session-123', 'test input\n');

      expect(result).toBe(true);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('test input\n');
    });

    it('should return false for non-existent session', () => {
      const result = claudeService.sendInput('non-existent', 'test input\n');

      expect(result).toBe(false);
    });
  });

  describe('getProcessStatus', () => {
    it('should return stopped for non-existent session', () => {
      const status = claudeService.getProcessStatus('non-existent');

      expect(status).toBe('stopped');
    });

    it('should return process status for existing session', async () => {
      const findClaudeExecutableSpy = jest.spyOn(claudeService as any, 'findClaudeExecutable');
      findClaudeExecutableSpy.mockResolvedValue('claude');

      await claudeService.startClaude('session-123', {
        workingDir: '/tmp',
        environment: {},
        args: [],
        autoRestart: false
      });

      // Simulate successful spawn
      const spawnCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'spawn')[1];
      spawnCallback();

      const status = claudeService.getProcessStatus('session-123');

      expect(status).toBe('running');
    });
  });
});