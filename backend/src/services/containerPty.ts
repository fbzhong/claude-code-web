import { EventEmitter } from 'events';
import { IPty } from 'node-pty';
import { ContainerManager } from './containerManager';

/**
 * ContainerPty wraps a process running in a container to provide
 * a node-pty compatible interface
 */
export class ContainerPty extends EventEmitter implements Partial<IPty> {
  private process: any;
  private _pid: number;
  private _cols: number;
  private _rows: number;
  private killed = false;
  
  constructor(
    private containerId: string,
    private containerManager: ContainerManager,
    private command: string[],
    private options: {
      cols: number;
      rows: number;
      cwd?: string;
      env?: Record<string, string>;
      user?: string;
    }
  ) {
    super();
    
    console.log(`[ContainerPty] Creating PTY for container ${containerId} with command:`, command);
    console.log(`[ContainerPty] Options:`, { 
      cols: options.cols, 
      rows: options.rows, 
      cwd: options.cwd, 
      user: options.user 
    });
    
    this._pid = process.pid; // Use parent process PID as placeholder
    this._cols = options.cols;
    this._rows = options.rows;
    
    this.start();
  }
  
  get pid(): number {
    return this._pid;
  }
  
  get cols(): number {
    return this._cols;
  }
  
  get rows(): number {
    return this._rows;
  }
  
  get process(): string {
    return this.command.join(' ');
  }
  
  private start(): void {
    console.log(`[ContainerPty] Starting interactive process in container ${this.containerId}`);
    
    // Start the interactive process in the container
    try {
      this.process = this.containerManager.execInteractive(
        this.containerId,
        this.command,
        {
          workingDir: this.options.cwd,
          environment: {
            ...this.options.env,
            COLUMNS: this._cols.toString(),
            LINES: this._rows.toString(),
          },
          user: this.options.user,
        }
      );
      
      console.log(`[ContainerPty] Started process for container ${this.containerId}`);
    } catch (error) {
      console.error(`[ContainerPty] Failed to start process:`, error);
      throw error;
    }
    
    // Handle stdout data
    this.process.stdout.on('data', (data: Buffer) => {
      this.emit('data', data.toString());
    });
    
    // Handle stderr data
    this.process.stderr.on('data', (data: Buffer) => {
      this.emit('data', data.toString());
    });
    
    // Handle process exit
    this.process.on('exit', (code: number, signal: string) => {
      this.emit('exit', { exitCode: code, signal });
      this.killed = true;
    });
    
    // Handle errors
    this.process.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }
  
  write(data: string): void {
    if (!this.killed && this.process.stdin) {
      this.process.stdin.write(data);
    }
  }
  
  resize(cols: number, rows: number): void {
    this._cols = cols;
    this._rows = rows;
    
    // Send resize escape sequence to the terminal
    // This works for most terminal emulators
    const resizeSequence = `\x1b[8;${rows};${cols}t`;
    this.write(resizeSequence);
    
    // Also try to resize using container exec
    // Some containers might support the 'resize' command
    this.containerManager.exec(
      this.containerId,
      ['sh', '-c', `stty cols ${cols} rows ${rows}`],
      { user: this.options.user }
    ).catch(() => {
      // Ignore errors, not all containers support this
    });
  }
  
  kill(signal?: string): void {
    if (!this.killed && this.process) {
      this.process.kill(signal || 'SIGTERM');
      this.killed = true;
    }
  }
  
  // Helper method to create a PTY-like interface for containers
  static spawn(
    containerManager: ContainerManager,
    containerId: string,
    shell: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
      user?: string;
    }
  ): ContainerPty {
    const command = [shell, ...args];
    
    return new ContainerPty(
      containerId,
      containerManager,
      command,
      {
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd,
        env: options.env,
        user: options.user || 'developer',
      }
    );
  }
  
  // Implement required IPty methods (even if not used)
  onData(listener: (data: string) => void): void {
    this.on('data', listener);
  }
  
  onExit(listener: (exitCode: number, signal?: number) => void): void {
    this.on('exit', ({ exitCode, signal }) => {
      listener(exitCode, signal);
    });
  }
}