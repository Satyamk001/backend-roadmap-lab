/**
 * Redis Persistence Simulation Engine (RDB & AOF)
 * Models point-in-time binary snapshots (RDB bgsave/fork),
 * append-only command logging (AOF with always/everysec/no fsync),
 * Copy-On-Write memory tracking, and crash-recovery data integrity.
 */

export type FsyncPolicy = 'always' | 'everysec' | 'no';
export type ServerStatus = 'running' | 'crashed' | 'recovering';

export interface AofEntry {
  id: string;
  command: string;
  key: string;
  value: string;
  tick: number;
}

export interface RdbSnapshotData {
  tick: number;
  timestamp: string;
  keyCount: number;
  data: Record<string, string>;
  sizeBytes: number;
}

export interface PersistenceLogEvent {
  id: string;
  tick: number;
  source: 'RAM' | 'RDB' | 'AOF' | 'CRASH' | 'RECOVERY';
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface PersistenceSnapshot {
  tick: number;
  serverStatus: ServerStatus;
  fsyncPolicy: FsyncPolicy;

  // RAM state (volatile)
  ramKeys: Record<string, string>;
  ramKeyCount: number;
  cowOverheadBytes: number;

  // RDB state (disk)
  rdbSnapshot: RdbSnapshotData | null;
  bgsaveInProgress: boolean;
  bgsaveCount: number;
  lastRdbSaveTick: number | null;

  // AOF state (buffer + disk)
  aofEnabled: boolean;
  aofBuffer: AofEntry[]; // in-memory pending fsync
  aofDiskFile: AofEntry[]; // written & fsynced to disk
  aofBaseSnapshot: Record<string, string> | null; // compacted base
  aofFileSizeBytes: number;

  // Recovery outcome after crash
  lastCrashReport?: {
    totalBeforeCrash: number;
    recoveredCount: number;
    lostCount: number;
    recoveredSource: 'AOF' | 'RDB' | 'NONE';
    lostKeys: string[];
  };

  whatJustHappened: string;
  whyItMatters: string;
  eventLog: PersistenceLogEvent[];
}

export class RedisPersistenceEngine {
  private tickCount: number = 0;
  private serverStatus: ServerStatus = 'running';
  private fsyncPolicy: FsyncPolicy = 'everysec';

  // RAM state (wiped on crash)
  private ramKeys: Map<string, string> = new Map();
  private cowOverheadBytes: number = 0;

  // RDB state (persisted on disk)
  private rdbSnapshot: RdbSnapshotData | null = null;
  private bgsaveInProgress: boolean = false;
  private bgsaveCount: number = 0;
  private lastRdbSaveTick: number | null = null;

  // AOF state
  private aofEnabled: boolean = true;
  private aofBuffer: AofEntry[] = [];
  private aofDiskFile: AofEntry[] = [];
  private aofBaseSnapshot: Record<string, string> | null = null;

  // Crash report
  private lastCrashReport?: PersistenceSnapshot['lastCrashReport'];
  private eventLog: PersistenceLogEvent[] = [];

  private whatJustHappened: string = 'Redis persistence engine active with AOF (everysec) aur RDB background saves.';
  private whyItMatters: string = 'RAM fast par volatile hai; restart ya power failure ke baad data wapas laane ke liye disk persistence zaroori hai.';

  constructor() {
    this.seedInitialDataset();
  }

  private seedInitialDataset(): void {
    // Seed initial keys
    this.ramKeys.set('sess:u101', 'active');
    this.ramKeys.set('lb:global:alice', '120');
    this.ramKeys.set('lb:global:bob', '95');

    // Create an initial baseline RDB snapshot
    const initialData: Record<string, string> = {};
    for (const [k, v] of this.ramKeys.entries()) {
      initialData[k] = v;
    }
    this.rdbSnapshot = {
      tick: 0,
      timestamp: '00:00:00',
      keyCount: this.ramKeys.size,
      data: initialData,
      sizeBytes: 154,
    };
    this.lastRdbSaveTick = 0;

    // Log initial AOF entries
    this.aofDiskFile = [
      { id: 'aof-0', command: 'SET', key: 'sess:u101', value: 'active', tick: 0 },
      { id: 'aof-1', command: 'ZADD', key: 'lb:global:alice', value: '120', tick: 0 },
      { id: 'aof-2', command: 'ZADD', key: 'lb:global:bob', value: '95', tick: 0 },
    ];
  }

  public getSnapshot(): PersistenceSnapshot {
    const ramObj: Record<string, string> = {};
    for (const [k, v] of this.ramKeys.entries()) {
      ramObj[k] = v;
    }

    const aofSize =
      this.aofDiskFile.reduce((acc, e) => acc + e.command.length + e.key.length + e.value.length + 12, 0) +
      (this.aofBaseSnapshot ? Object.keys(this.aofBaseSnapshot).length * 40 : 0);

    return {
      tick: this.tickCount,
      serverStatus: this.serverStatus,
      fsyncPolicy: this.fsyncPolicy,
      ramKeys: ramObj,
      ramKeyCount: this.ramKeys.size,
      cowOverheadBytes: this.cowOverheadBytes,
      rdbSnapshot: this.rdbSnapshot ? { ...this.rdbSnapshot, data: { ...this.rdbSnapshot.data } } : null,
      bgsaveInProgress: this.bgsaveInProgress,
      bgsaveCount: this.bgsaveCount,
      lastRdbSaveTick: this.lastRdbSaveTick,
      aofEnabled: this.aofEnabled,
      aofBuffer: [...this.aofBuffer],
      aofDiskFile: [...this.aofDiskFile],
      aofBaseSnapshot: this.aofBaseSnapshot ? { ...this.aofBaseSnapshot } : null,
      aofFileSizeBytes: aofSize,
      lastCrashReport: this.lastCrashReport ? { ...this.lastCrashReport, lostKeys: [...this.lastCrashReport.lostKeys] } : undefined,
      whatJustHappened: this.whatJustHappened,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog].slice(0, 100),
    };
  }

  private pushLog(source: PersistenceLogEvent['source'], message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.eventLog.unshift({
      id: `evt-${this.tickCount}-${Math.random().toString(36).slice(2, 7)}`,
      tick: this.tickCount,
      source,
      message,
      type,
    });
  }

  /**
   * Action: Write a command into Redis
   */
  public write(command: 'SET' | 'INCR' | 'DEL', key: string, value: string): boolean {
    if (this.serverStatus === 'crashed') {
      this.pushLog('RAM', `Server down hai! Write ${command} ${key} reject ho gaya`, 'error');
      this.whatJustHappened = 'Server crashed state me hai; koi write accept nahi ho sakti.';
      this.whyItMatters = 'Downtime me client requests fail hoti hain; restart karke recovery trigger karein.';
      return false;
    }

    this.tickCount++;

    // Mutate RAM
    if (command === 'DEL') {
      this.ramKeys.delete(key);
    } else {
      this.ramKeys.set(key, value);
    }

    // Copy-on-Write tracking if BGSAVE is running
    if (this.bgsaveInProgress) {
      this.cowOverheadBytes += 4096; // 4KB Linux memory page duplicated on write
    }

    // Append to AOF Buffer
    const entry: AofEntry = {
      id: `aof-${this.tickCount}-${Math.random().toString(36).slice(2, 6)}`,
      command,
      key,
      value,
      tick: this.tickCount,
    };
    this.aofBuffer.push(entry);

    // If fsync policy is ALWAYS, flush immediately to disk
    if (this.fsyncPolicy === 'always') {
      this.flushAofBuffer();
    }

    this.pushLog('RAM', `${command} ${key} = "${value}" RAM me likha gaya`, 'success');
    this.whatJustHappened = `Write "${command} ${key} ${value}" RAM me update hua aur AOF buffer me append hua.`;
    this.whyItMatters =
      this.fsyncPolicy === 'always'
        ? 'always policy me har command ke turant baad disk par fsync hota hai (zero loss, slower).'
        : 'everysec policy me command pehle RAM buffer me rehti hai; agle tick par disk par flush hogi.';
    return true;
  }

  /**
   * Action: Trigger BGSAVE (RDB Snapshot via fork)
   */
  public triggerBgsave(): void {
    if (this.serverStatus === 'crashed') return;
    this.tickCount++;
    this.bgsaveCount++;
    this.bgsaveInProgress = true;

    // Snapshot current RAM data (frozen point-in-time)
    const snapshotData: Record<string, string> = {};
    for (const [k, v] of this.ramKeys.entries()) {
      snapshotData[k] = v;
    }

    // Complete bgsave deterministically
    this.rdbSnapshot = {
      tick: this.tickCount,
      timestamp: `Tick +${this.tickCount}`,
      keyCount: Object.keys(snapshotData).length,
      data: snapshotData,
      sizeBytes: Object.keys(snapshotData).length * 48 + 50,
    };
    this.lastRdbSaveTick = this.tickCount;
    this.bgsaveInProgress = false;
    this.cowOverheadBytes = 0; // COW freed after child exits

    this.pushLog('RDB', `BGSAVE complete! dump.rdb updated (${this.rdbSnapshot.keyCount} keys, ${this.rdbSnapshot.sizeBytes} B)`);
    this.whatJustHappened = `BGSAVE ne fork child banakar point-in-time snapshot dump.rdb disk par save kar diya.`;
    this.whyItMatters = 'RDB compact binary photo hoti hai jo machine restart par bahut fast load hoti hai.';
  }

  /**
   * Action: Flush AOF buffer to disk (simulates fsync)
   */
  public flushAofBuffer(): number {
    if (this.aofBuffer.length === 0) return 0;
    const count = this.aofBuffer.length;
    this.aofDiskFile.push(...this.aofBuffer);
    this.aofBuffer = [];
    this.pushLog('AOF', `fsync completed! ${count} write commands disk file me flush ho gaye.`);
    this.whatJustHappened = `fsync ne AOF buffer ke ${count} commands disk par save kar diye.`;
    this.whyItMatters = 'fsync ke bina data OS write buffer me rehta hai; machine crash par OS buffer ka data chala jaata hai.';
    return count;
  }

  /**
   * Action: Background AOF Rewrite (BGREWRITEAOF)
   * Compacts all past commands into minimum state
   */
  public triggerAofRewrite(): void {
    if (this.serverStatus === 'crashed') return;
    this.tickCount++;

    // Flush any pending buffer first
    this.flushAofBuffer();

    // Create compacted base snapshot from current RAM keys
    const compacted: Record<string, string> = {};
    for (const [k, v] of this.ramKeys.entries()) {
      compacted[k] = v;
    }

    const previousDiskCount = this.aofDiskFile.length;
    this.aofBaseSnapshot = compacted;
    this.aofDiskFile = []; // incremental entries reset because base has everything

    this.pushLog('AOF', `BGREWRITEAOF complete! ${previousDiskCount} commands compacted into 1 clean base snapshot.`);
    this.whatJustHappened = `AOF rewrite ne ${previousDiskCount} purane commands ko 1 compact base file me merge kar diya.`;
    this.whyItMatters = 'Rewrite ke bina AOF file endlessly badhti rehti hai; rewrite se disk space aur recovery time dono bachte hain.';
  }

  /**
   * Action: Crash the Redis server (power loss / kill -9)
   */
  public crashServer(): void {
    if (this.serverStatus === 'crashed') return;
    this.tickCount++;
    this.serverStatus = 'crashed';

    // Volatile RAM is instantly wiped
    this.ramKeys.clear();
    this.aofBuffer = []; // volatile write buffer lost!
    this.bgsaveInProgress = false;
    this.cowOverheadBytes = 0;

    this.pushLog(
      'CRASH',
      `SERVER CRASHED (kill -9 / power failure)! RAM volatile memory wiped to 0. Unflushed AOF buffer lost.`,
      'error'
    );

    this.whatJustHappened = `BOOM! Server crash hua. RAM ka saara data chala gaya aur un-fsynced buffer kho gaya.`;
    this.whyItMatters = 'Volatile RAM bina disk persistence ke restart par poora data kho deti hai. Ab dekhte hain disk se kya bacha.';
  }

  /**
   * Action: Restart server & recover data from disk
   */
  public restartServer(): void {
    if (this.serverStatus === 'running') return;
    this.tickCount++;
    this.serverStatus = 'running';

    let recoveredKeys: Record<string, string> = {};
    let recoveredSource: 'AOF' | 'RDB' | 'NONE' = 'NONE';

    // Redis recovery priority rule: If AOF enabled, Redis ALWAYS loads AOF first
    if (this.aofEnabled && (this.aofDiskFile.length > 0 || this.aofBaseSnapshot !== null)) {
      recoveredSource = 'AOF';
      // Load base snapshot if exists
      if (this.aofBaseSnapshot) {
        recoveredKeys = { ...this.aofBaseSnapshot };
      }
      // Replay incremental AOF log
      for (const entry of this.aofDiskFile) {
        if (entry.command === 'DEL') {
          delete recoveredKeys[entry.key];
        } else {
          recoveredKeys[entry.key] = entry.value;
        }
      }
    } else if (this.rdbSnapshot) {
      // Fallback to RDB snapshot
      recoveredSource = 'RDB';
      recoveredKeys = { ...this.rdbSnapshot.data };
    }

    // Populate RAM with recovered keys
    this.ramKeys.clear();
    for (const [k, v] of Object.entries(recoveredKeys)) {
      this.ramKeys.set(k, v);
    }

    const recoveredCount = this.ramKeys.size;
    this.lastCrashReport = {
      totalBeforeCrash: recoveredCount,
      recoveredCount,
      lostCount: 0,
      recoveredSource,
      lostKeys: [],
    };

    this.pushLog(
      'RECOVERY',
      `Server restarted! Recovered ${recoveredCount} keys via ${recoveredSource} playback.`,
      'success'
    );

    this.whatJustHappened = `Restart complete! Redis ne disk se ${recoveredSource} load karke ${recoveredCount} keys restore kar liye.`;
    this.whyItMatters =
      recoveredSource === 'AOF'
        ? 'Dono files hone par Redis AOF se restart hota hai kyunki AOF zyada up-to-date hoti hai.'
        : 'AOF off hone par Redis last RDB snapshot load karta hai (snapshot ke baad ke writes kho jaate hain).';
  }

  /**
   * Action: Change fsync policy
   */
  public setFsyncPolicy(policy: FsyncPolicy): void {
    const old = this.fsyncPolicy;
    this.fsyncPolicy = policy;
    this.pushLog('AOF', `appendfsync policy changed: ${old} → ${policy}`);
    this.whatJustHappened = `AOF fsync policy badal kar '${policy}' kar di gayi.`;
    this.whyItMatters =
      policy === 'always'
        ? 'always = har write disk par flush, safe par slow.'
        : policy === 'everysec'
        ? 'everysec = best balance, max 1 second data loss window in worst crash.'
        : 'no = OS buffer par depend, fastest par risk maximum.';
  }

  public reset(): void {
    this.ramKeys.clear();
    this.aofBuffer = [];
    this.aofDiskFile = [];
    this.aofBaseSnapshot = null;
    this.rdbSnapshot = null;
    this.eventLog = [];
    this.tickCount = 0;
    this.bgsaveCount = 0;
    this.bgsaveInProgress = false;
    this.serverStatus = 'running';
    this.lastCrashReport = undefined;
    this.seedInitialDataset();
  }
}
