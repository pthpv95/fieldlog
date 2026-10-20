import { HLC, compare } from './hlc.js';

export interface FieldValue<T = unknown> {
  value: T;
  hlc: HLC | string;
}

export interface MergeResult<T = unknown> {
  value: T;
  hlc: HLC | string;
  hadConflict: boolean;
  losingValue?: T;
  losingHlc?: HLC | string;
}

/**
 * Per-field Last-Writer-Wins merge using Hybrid Logical Clocks
 * 
 * This is the core conflict resolution algorithm used on both client and server:
 * - When pulling changes from server: merge server fields into local pending fields
 * - When pushing to server: server merges client fields into current server fields
 * 
 * Rules:
 * 1. The field with the higher HLC always wins
 * 2. When a conflict occurs (both sides modified the same field), the losing value
 *    is captured in the result for conflict logging
 * 3. This function is pure and deterministic - same inputs always produce same output
 * 4. Convergence property: merge(A, B) and merge(B, A) converge to the same final state
 */
export function mergeField<T>(
  local: FieldValue<T> | undefined,
  remote: FieldValue<T> | undefined
): MergeResult<T> | undefined {
  if (!local && !remote) {
    return undefined;
  }
  
  if (!local) {
    return {
      value: remote!.value,
      hlc: remote!.hlc,
      hadConflict: false,
    };
  }
  
  if (!remote) {
    return {
      value: local.value,
      hlc: local.hlc,
      hadConflict: false,
    };
  }
  
  const cmp = compare(local.hlc, remote.hlc);
  
  if (cmp === 0) {
    return {
      value: local.value,
      hlc: local.hlc,
      hadConflict: false,
    };
  }
  
  if (cmp > 0) {
    return {
      value: local.value,
      hlc: local.hlc,
      hadConflict: true,
      losingValue: remote.value,
      losingHlc: remote.hlc,
    };
  }
  
  return {
    value: remote.value,
    hlc: remote.hlc,
    hadConflict: true,
    losingValue: local.value,
    losingHlc: local.hlc,
  };
}

/**
 * Merge entire records field-by-field
 * Returns the merged record, list of winning fields, and list of conflicts
 */
export interface MergeRecordResult<T extends Record<string, unknown>> {
  merged: T;
  conflicts: Array<{
    field: string;
    winningValue: unknown;
    winningHlc: HLC | string;
    losingValue: unknown;
    losingHlc: HLC | string;
  }>;
}

export function mergeRecord<T extends Record<string, unknown>>(
  localFields: Record<string, FieldValue>,
  remoteFields: Record<string, FieldValue>
): MergeRecordResult<T> {
  const merged: Record<string, unknown> = {};
  const conflicts: MergeRecordResult<T>['conflicts'] = [];
  
  const allFields = new Set([
    ...Object.keys(localFields),
    ...Object.keys(remoteFields),
  ]);
  
  for (const field of allFields) {
    const result = mergeField(localFields[field], remoteFields[field]);
    
    if (result) {
      merged[field] = result.value;
      
      if (result.hadConflict && result.losingValue !== undefined) {
        conflicts.push({
          field,
          winningValue: result.value,
          winningHlc: result.hlc,
          losingValue: result.losingValue,
          losingHlc: result.losingHlc!,
        });
      }
    }
  }
  
  return {
    merged: merged as T,
    conflicts,
  };
}
