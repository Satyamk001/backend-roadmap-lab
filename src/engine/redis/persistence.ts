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
  /** Key this event refers to, used by the UI to highlight the affected card. */
  key?: string;
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
  private lastRamBeforeCrash: Record<string, string> | null = null;
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

  private pushLog(
    source: PersistenceLogEvent['source'],
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    key?: string
  ): void {
    this.eventLog.unshift({
      id: `evt-${this.tickCount}-${this.eventLog.length}`,
      tick: this.tickCount,
      source,
      message,
      type,
      key,
    });
  }

  /** Lets a focused demo set a scenario-specific starting explanation. */
  public setNarrative(whatJustHappened: string, whyItMatters: string): void {
    this.whatJustHappened = whatJustHappened;
    this.whyItMatters = whyItMatters;
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

    // AOF is optional. In RDB-only mode the append buffer must stay empty.
    if (this.aofEnabled) {
      const entry: AofEntry = {
        id: `aof-${this.tickCount}-${this.aofDiskFile.length + this.aofBuffer.length}`,
        command,
        key,
        value,
        tick: this.tickCount,
      };
      this.aofBuffer.push(entry);

      if (this.fsyncPolicy === 'always') {
        this.flushAofBuffer();
      }
    }

    this.pushLog('RAM', `${command} ${key} = "${value}" RAM me likha gaya`, 'success', key);
    this.whatJustHappened = this.aofEnabled
      ? `Write "${command} ${key} ${value}" RAM me update hua aur AOF buffer me append hua.`
      : `Write "${command} ${key} ${value}" sirf RAM me hua; AOF off hai.`;
    this.whyItMatters = !this.aofEnabled
      ? 'AOF off hone par crash recovery sirf RDB snapshot se hogi; naya write snapshot tak nahi pahuncha.'
      : this.fsyncPolicy === 'always'
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

    // Keep a copy for the post-restart loss report before RAM is wiped.
    this.lastRamBeforeCrash = {};
    for (const [key, value] of this.ramKeys.entries()) {
      this.lastRamBeforeCrash[key] = value;
    }

    this.serverStatus = 'crashed';
    const unflushedWrites = this.aofEnabled ? this.aofBuffer.length : 0;
    const aofLossText = !this.aofEnabled
      ? 'AOF off thi, isliye sirf RDB snapshot bachega.'
      : unflushedWrites > 0
      ? `${unflushedWrites} un-fsynced AOF writes bhi lost.`
      : 'AOF buffer khaali tha, koi pending write nahi.';

    // Volatile RAM is instantly wiped
    this.ramKeys.clear();
    this.aofBuffer = []; // volatile write buffer lost!
    this.bgsaveInProgress = false;
    this.cowOverheadBytes = 0;

    this.pushLog(
      'CRASH',
      `SERVER CRASHED (kill -9 / power failure)! RAM wiped. ${aofLossText}`,
      'error'
    );

    this.whatJustHappened = `BOOM! Server crash hua. RAM ka data chala gaya${
      unflushedWrites > 0 ? ` aur ${unflushedWrites} un-fsynced AOF write bhi` : ''
    }.`;
    this.whyItMatters =
      'Crash ke baad RAM khaali hai. Ab decide hoga ki RDB snapshot ya AOF log se kitna data wapas aata hai.';
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
      if (this.aofBaseSnapshot) {
        recoveredKeys = { ...this.aofBaseSnapshot };
      }
      for (const entry of this.aofDiskFile) {
        if (entry.command === 'DEL') {
          delete recoveredKeys[entry.key];
        } else {
          recoveredKeys[entry.key] = entry.value;
        }
      }
    } else if (this.rdbSnapshot) {
      recoveredSource = 'RDB';
      recoveredKeys = { ...this.rdbSnapshot.data };
    }

    this.ramKeys.clear();
    for (const [k, v] of Object.entries(recoveredKeys)) {
      this.ramKeys.set(k, v);
    }

    const before = this.lastRamBeforeCrash ?? {};
    const lostKeys = Object.keys(before).filter(
      (key) => recoveredKeys[key] === undefined || recoveredKeys[key] !== before[key]
    );
    const recoveredCount = this.ramKeys.size;

    this.lastCrashReport = {
      totalBeforeCrash: Object.keys(before).length,
      recoveredCount,
      lostCount: lostKeys.length,
      recoveredSource,
      lostKeys,
    };

    this.pushLog(
      'RECOVERY',
      `Server restarted via ${recoveredSource}. ${recoveredCount} keys recovered, ${lostKeys.length} ${
        lostKeys.length === 1 ? 'write' : 'writes'
      } lost${lostKeys.length > 0 ? `: ${lostKeys.join(', ')}` : ''}.`,
      lostKeys.length > 0 ? 'info' : 'success'
    );

    this.whatJustHappened =
      lostKeys.length > 0
        ? `Restart ke baad ${recoveredSource} se ${recoveredCount} keys aayi, par ${lostKeys.length} write lost: ${lostKeys.join(', ')}.`
        : `Restart ke baad ${recoveredSource} se ${recoveredCount} keys restore hui — koi write lost nahi.`;
    this.whyItMatters =
      recoveredSource === 'AOF'
        ? 'AOF replay ne har fsynced write wapas laaya. Isliye AOF crash durability ke liye stronger hai.'
        : 'RDB sirf last snapshot ka data deta hai; snapshot ke baad ke writes crash par kho jaate hain.';

    this.lastRamBeforeCrash = null;
  }

  /**
   * Action: Enable or disable AOF. Disabling it makes RDB the recovery source.
   */
  public setAofEnabled(enabled: boolean): void {
    if (this.aofEnabled === enabled) return;
    this.tickCount++;
    this.aofEnabled = enabled;
    if (!enabled) this.aofBuffer = [];
    this.pushLog(
      'AOF',
      enabled ? 'AOF enabled: writes ab append log me jaayengi.' : 'AOF disabled: restart par sirf RDB snapshot milega.',
      'info'
    );
    this.whatJustHappened = enabled
      ? 'AOF on ho gaya. Ab write commands append log me jaayengi.'
      : 'AOF off ho gaya. Ab crash recovery sirf RDB snapshot se hogi.';
    this.whyItMatters = enabled
      ? 'AOF replay se snapshot ke baad ke writes bhi wapas aa sakte hain.'
      : 'RDB-only mode me last snapshot ke baad ka data crash par lost ho sakta hai.';
  }

  /**
   * Action: Advance virtual time. Models the everysec background fsync boundary.
   */
  public advanceTime(seconds: number = 1): void {
    if (this.serverStatus === 'crashed') return;
    this.tickCount += seconds;

    if (this.fsyncPolicy === 'everysec' && this.aofBuffer.length > 0) {
      const flushed = this.flushAofBuffer();
      this.whatJustHappened = `everysec fsync boundary aayi: ${flushed} buffered writes disk par chale gaye.`;
      this.whyItMatters =
        'everysec me worst case 1 second ka data loss hota hai; buffer disk par pahuncha to crash ke baad replay hoga.';
    } else {
      this.pushLog(
        'AOF',
        `Time +${seconds}s. ${this.fsyncPolicy === 'everysec' ? 'AOF buffer already empty.' : `Policy '${this.fsyncPolicy}' me automatic fsync nahi hota.`}`,
        'info'
      );
      this.whatJustHappened = `Time +${seconds}s. AOF buffer me ${this.aofBuffer.length} pending writes hain.`;
      this.whyItMatters =
        this.fsyncPolicy === 'always'
          ? 'always policy har write ke baad flush karti hai, isliye buffer khaali rehta hai.'
          : 'no policy me flush ka control OS ke paas hota hai; crash par pending writes kho sakte hain.';
    }
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
    this.fsyncPolicy = 'everysec';
    this.aofEnabled = true;
    this.lastCrashReport = undefined;
    this.lastRamBeforeCrash = null;
    this.seedInitialDataset();
  }
}
