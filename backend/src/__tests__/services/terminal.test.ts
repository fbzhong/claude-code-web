import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TerminalService } from '../../services/terminal';

// Mock node-pty
jest.mock('node-pty', () => ({
  spawn: jest.fn()
}));

describe('TerminalService', () => {
  let terminalService: TerminalService;
  let mockFastify: any;
  let mockPty: any;

  beforeEach(() => {
    mockPty = {
      onData: jest.fn(),
      onExit: jest.fn(),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn()
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

    const { spawn } = require('node-pty');
    (spawn as jest.Mock).mockReturnValue(mockPty);

    terminalService = new TerminalService(mockFastify);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new terminal session', async () => {
      const userId = 'user-123';
      const sessionId = 'session-123';

      const session = await terminalService.createSession(userId, sessionId);

      expect(session).toMatchObject({
        id: sessionId,
        userId: userId,
        pty: mockPty,
        history: [],
        workingDir: expect.any(String),
        environment: {}
      });

      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('should set up PTY event handlers', async () => {
      await terminalService.createSession('user-123', 'session-123');

      expect(mockPty.onData).toHaveBeenCalledWith(expect.any(Function));
      expect(mockPty.onExit).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should save session to database', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      mockFastify.pg.connect.mockResolvedValue(mockClient);

      await terminalService.createSession('user-123', 'session-123');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO terminal_sessions'),
        expect.any(Array)
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('writeToSession', () => {
    beforeEach(async () => {
      await terminalService.createSession('user-123', 'session-123');
    });

    it('should write data to PTY', () => {
      const result = terminalService.writeToSession('session-123', 'test input');

      expect(result).toBe(true);
      expect(mockPty.write).toHaveBeenCalledWith('test input');
    });

    it('should return false for non-existent session', () => {
      const result = terminalService.writeToSession('non-existent', 'test input');

      expect(result).toBe(false);
      expect(mockPty.write).not.toHaveBeenCalled();
    });

    it('should record command on enter', () => {
      const recordCommandSpy = jest.spyOn(terminalService as any, 'recordCommand');
      recordCommandSpy.mockImplementation(() => Promise.resolve());

      // Simulate typing a command
      terminalService.writeToSession('session-123', 'l');
      terminalService.writeToSession('session-123', 's');
      terminalService.writeToSession('session-123', '\r'); // Enter

      expect(recordCommandSpy).toHaveBeenCalledWith('session-123', 'ls');
    });
  });

  describe('resizeSession', () => {
    beforeEach(async () => {
      await terminalService.createSession('user-123', 'session-123');
    });

    it('should resize PTY', () => {
      const result = terminalService.resizeSession('session-123', 120, 30);

      expect(result).toBe(true);
      expect(mockPty.resize).toHaveBeenCalledWith(120, 30);
    });

    it('should return false for non-existent session', () => {
      const result = terminalService.resizeSession('non-existent', 120, 30);

      expect(result).toBe(false);
      expect(mockPty.resize).not.toHaveBeenCalled();
    });
  });

  describe('killSession', () => {
    beforeEach(async () => {
      await terminalService.createSession('user-123', 'session-123');
    });

    it('should kill PTY and remove session', async () => {
      const result = await terminalService.killSession('session-123');

      expect(result).toBe(true);
      expect(mockPty.kill).toHaveBeenCalled();
      expect(terminalService.getSession('session-123')).toBeUndefined();
    });

    it('should return false for non-existent session', async () => {
      const result = await terminalService.killSession('non-existent');

      expect(result).toBe(false);
      expect(mockPty.kill).not.toHaveBeenCalled();
    });
  });

  describe('getSessionHistory', () => {
    it('should fetch session history from database', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              id: 'history-1',
              session_id: 'session-123',
              command: 'ls -la',
              output: 'file1.txt\nfile2.txt',
              exit_code: 0,
              timestamp: new Date(),
              duration: 100
            }
          ]
        }),
        release: jest.fn()
      };
      mockFastify.pg.connect.mockResolvedValue(mockClient);

      const history = await terminalService.getSessionHistory('session-123');

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: 'history-1',
        sessionId: 'session-123',
        command: 'ls -la',
        output: 'file1.txt\nfile2.txt',
        exitCode: 0,
        duration: 100
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM command_history'),
        ['session-123']
      );
    });

    it('should return empty array on database error', async () => {
      mockFastify.pg.connect.mockRejectedValue(new Error('Database error'));

      const history = await terminalService.getSessionHistory('session-123');

      expect(history).toEqual([]);
      expect(mockFastify.log.error).toHaveBeenCalled();
    });
  });
});