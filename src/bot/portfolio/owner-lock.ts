/** Cooperative single-host account/symbol lease. Never steals an existing lock.
 * Legacy owners without this contract still require explicit cutover retirement.
 */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export class PortfolioOwnerLease {
  private released = false;
  private readonly records: { file: string; bytes: string }[] = [];
  constructor(directory: string, readonly uid: string, readonly symbol = 'HYPEUSDT') {
    if (!/^\d+$/.test(uid) || symbol !== 'HYPEUSDT') throw new Error('invalid portfolio lock identity');
    fs.mkdirSync(directory, { recursive: true });
    const token = randomBytes(16).toString('hex');
    try {
      // Side 1 deliberately shares the existing SF08 lock naming contract.
      for (const side of [1, 2]) {
        const file = path.resolve(directory, `${uid}-${symbol}-${side}.lock`);
        const bytes = JSON.stringify({ version: 1, pid: process.pid, uid, symbol, side, token });
        const fd = fs.openSync(file, 'wx', 0o600);
        try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
        catch (e) {
          // Keep an incomplete lock for operator inspection; never infer ownership
          // from a partial write or delete another process's replacement file.
          throw e;
        } finally { fs.closeSync(fd); }
        this.records.push({ file, bytes });
      }
    } catch (e) {
      this.release();
      throw new Error('portfolio account lock unavailable; verify stopped owners, never auto-remove a stale lock', { cause: e });
    }
  }
  assertHeld(uid: string): void {
    if (this.released || uid !== this.uid || this.records.length !== 2) throw new Error('portfolio owner lease not held');
    for (const r of this.records)
      if (fs.readFileSync(r.file, 'utf8') !== r.bytes) throw new Error('portfolio owner lease changed');
  }
  release(): void {
    if (this.released) return;
    this.released = true;
    for (const r of this.records) {
      try { if (fs.readFileSync(r.file, 'utf8') === r.bytes) fs.unlinkSync(r.file); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    }
  }
}
