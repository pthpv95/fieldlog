/**
 * Hybrid Logical Clock (HLC) implementation
 * Based on "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases"
 * by Kulkarni et al. (2014)
 * 
 * HLC format: "<logicalTime>-<counter>"
 * - logicalTime: max(wallClock, lastLogicalTime) in milliseconds
 * - counter: monotonically increasing for events within the same millisecond
 */

export interface HLC {
  logicalTime: number;
  counter: number;
}

export interface HLCState {
  logicalTime: number;
  counter: number;
}

const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export function parseHLC(hlcString: string): HLC {
  const parts = hlcString.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid HLC format: ${hlcString}`);
  }
  const logicalTime = parseInt(parts[0], 10);
  const counter = parseInt(parts[1], 10);
  if (isNaN(logicalTime) || isNaN(counter)) {
    throw new Error(`Invalid HLC format: ${hlcString}`);
  }
  return { logicalTime, counter };
}

export function formatHLC(hlc: HLC): string {
  return `${hlc.logicalTime}-${hlc.counter}`;
}

export function createHLCState(): HLCState {
  return {
    logicalTime: 0,
    counter: 0,
  };
}

/**
 * Generate a new HLC timestamp for a local event
 */
export function tick(state: HLCState, wallClock: number = Date.now()): HLC {
  const newLogicalTime = Math.max(state.logicalTime, wallClock);
  
  if (newLogicalTime === state.logicalTime) {
    state.counter++;
  } else {
    state.logicalTime = newLogicalTime;
    state.counter = 0;
  }
  
  return {
    logicalTime: state.logicalTime,
    counter: state.counter,
  };
}

/**
 * Update local HLC state based on a received remote timestamp
 */
export function receive(state: HLCState, remote: HLC, wallClock: number = Date.now()): HLC {
  const now = wallClock;
  const newLogicalTime = Math.max(Math.max(state.logicalTime, remote.logicalTime), now);
  
  if (newLogicalTime === state.logicalTime && newLogicalTime === remote.logicalTime) {
    state.counter = Math.max(state.counter, remote.counter) + 1;
  } else if (newLogicalTime === state.logicalTime) {
    state.counter++;
  } else if (newLogicalTime === remote.logicalTime) {
    state.counter = remote.counter + 1;
  } else {
    state.logicalTime = newLogicalTime;
    state.counter = 0;
  }
  
  state.logicalTime = newLogicalTime;
  
  return {
    logicalTime: state.logicalTime,
    counter: state.counter,
  };
}

/**
 * Compare two HLC timestamps
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compare(a: HLC | string, b: HLC | string): number {
  const hlcA = typeof a === 'string' ? parseHLC(a) : a;
  const hlcB = typeof b === 'string' ? parseHLC(b) : b;
  
  if (hlcA.logicalTime !== hlcB.logicalTime) {
    return hlcA.logicalTime < hlcB.logicalTime ? -1 : 1;
  }
  
  if (hlcA.counter !== hlcB.counter) {
    return hlcA.counter < hlcB.counter ? -1 : 1;
  }
  
  return 0;
}

/**
 * Clamp a future HLC timestamp to prevent clock drift
 * Used on the server to handle clients with incorrect clocks
 */
export function clampFuture(hlc: HLC, now: number = Date.now()): { clamped: HLC; wasClamped: boolean } {
  const drift = hlc.logicalTime - now;
  
  if (drift > MAX_DRIFT_MS) {
    return {
      clamped: {
        logicalTime: now + MAX_DRIFT_MS,
        counter: hlc.counter,
      },
      wasClamped: true,
    };
  }
  
  return { clamped: hlc, wasClamped: false };
}
