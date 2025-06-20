import { EventEmitter } from "events";
import { ExecSession } from "./containerManager";

/**
 * PTY Adapter - Makes dockerode exec session compatible with node-pty interface
 */
export class PtyAdapter extends EventEmitter {
  private _pid: number;
  private _process: string;
  private killed = false;

  constructor(private execSession: ExecSession, private sessionId: string) {
    super();

    // Generate a fake PID for compatibility
    this._pid = Math.floor(Math.random() * 100000);
    this._process = "bash";

    // Forward data from Docker stream
    this.execSession.stream.on("data", (data: Buffer) => {
      // console.log(`[PtyAdapter ${sessionId}] received data from Docker:`, {
      //   length: data.length,
      //   first10Bytes: Array.from(data.slice(0, 10)),
      //   preview: data.toString('utf8').substring(0, 50).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
      // });
      
      // Docker uses multiplexed streams even with Tty: true when using hijack
      // Format: [stream_type(1)][000(3)][size(4)][payload]
      if (data.length > 8 && data[0] !== undefined && data[0] <= 2) {
        const payloadSize = data.readUInt32BE(4);
        if (payloadSize > 0 && data.length >= 8 + payloadSize) {
          // Extract payload, skipping the 8-byte header
          const payload = data.slice(8, 8 + payloadSize);
          // console.log(`[PtyAdapter ${sessionId}] demuxed payload:`, payload.toString('utf8').substring(0, 50));
          this.emit("data", payload.toString());

          // If there's more data after this packet, process it recursively
          if (data.length > 8 + payloadSize) {
            const remaining = data.slice(8 + payloadSize);
            this.execSession.stream.emit("data", remaining);
          }
          return;
        }
      }

      // Fallback: forward raw data if not multiplexed format
      console.log(`[PtyAdapter ${sessionId}] forwarding raw data`);
      this.emit("data", data.toString());
    });

    // Handle stream end
    this.execSession.stream.on("end", () => {
      this.handleExit(0);
    });

    // Handle stream error
    this.execSession.stream.on("error", (err: Error) => {
      console.error(`PTY stream error for session ${sessionId}:`, err);
      this.handleExit(1);
    });
  }

  // Implement node-pty compatible interface
  get pid(): number {
    return this._pid;
  }

  get process(): string {
    return this._process;
  }

  write(data: string): void {
    // console.log(`[PtyAdapter ${this.sessionId}] write called:`, {
    //   killed: this.killed,
    //   writable: this.execSession.stream.writable,
    //   dataLength: data.length,
    //   data: data.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    // });
    
    if (!this.killed && this.execSession.stream.writable) {
      try {
        const written = this.execSession.stream.write(data);
        // console.log(`[PtyAdapter ${this.sessionId}] write result:`, written);
      } catch (error) {
        console.error(`[PtyAdapter ${this.sessionId}] write error:`, error);
      }
    }
  }

  resize(cols: number, rows: number): void {
    if (!this.killed) {
      this.execSession.resize(rows, cols).catch((err) => {
        console.warn(
          `Failed to resize PTY for session ${this.sessionId}:`,
          err
        );
      });
    }
  }

  kill(signal?: string): void {
    if (!this.killed) {
      this.killed = true;
      this.execSession.kill();
      this.handleExit(signal === "SIGKILL" ? 137 : 143);
    }
  }

  // node-pty event handlers
  onData(callback: (data: string) => void): void {
    this.on("data", callback);
  }

  onExit(callback: (exitCode: number, signal?: number) => void): void {
    this.on("exit", callback);
  }

  private handleExit(code: number): void {
    if (!this.killed) {
      this.killed = true;
      this.emit("exit", { exitCode: code, signal: undefined });
    }
  }
}
