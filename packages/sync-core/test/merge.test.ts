import { describe, it, expect } from 'vitest';
import { mergeField, mergeRecord, type FieldValue, type MergeRecordResult } from '../src/merge.js';

describe('merge', () => {
  describe('mergeField', () => {
    it('should keep remote when local is undefined', () => {
      const remote: FieldValue<string> = { value: 'remote', hlc: '1000-0' };
      
      const result = mergeField(undefined, remote);
      
      expect(result).toEqual({
        value: 'remote',
        hlc: '1000-0',
        hadConflict: false,
      });
    });

    it('should keep local when remote is undefined', () => {
      const local: FieldValue<string> = { value: 'local', hlc: '1000-0' };
      
      const result = mergeField(local, undefined);
      
      expect(result).toEqual({
        value: 'local',
        hlc: '1000-0',
        hadConflict: false,
      });
    });

    it('should return undefined when both are undefined', () => {
      const result = mergeField(undefined, undefined);
      expect(result).toBeUndefined();
    });

    it('should use local when HLCs are equal', () => {
      const local: FieldValue<string> = { value: 'local', hlc: '1000-0' };
      const remote: FieldValue<string> = { value: 'remote', hlc: '1000-0' };
      
      const result = mergeField(local, remote);
      
      expect(result).toEqual({
        value: 'local',
        hlc: '1000-0',
        hadConflict: false,
      });
    });

    it('should use local when local HLC is newer', () => {
      const local: FieldValue<string> = { value: 'local', hlc: '2000-0' };
      const remote: FieldValue<string> = { value: 'remote', hlc: '1000-0' };
      
      const result = mergeField(local, remote);
      
      expect(result).toEqual({
        value: 'local',
        hlc: '2000-0',
        hadConflict: true,
        losingValue: 'remote',
        losingHlc: '1000-0',
      });
    });

    it('should use remote when remote HLC is newer', () => {
      const local: FieldValue<string> = { value: 'local', hlc: '1000-0' };
      const remote: FieldValue<string> = { value: 'remote', hlc: '2000-0' };
      
      const result = mergeField(local, remote);
      
      expect(result).toEqual({
        value: 'remote',
        hlc: '2000-0',
        hadConflict: true,
        losingValue: 'local',
        losingHlc: '1000-0',
      });
    });

    it('should compare by counter when logicalTime is equal', () => {
      const local: FieldValue<string> = { value: 'local', hlc: '1000-5' };
      const remote: FieldValue<string> = { value: 'remote', hlc: '1000-10' };
      
      const result = mergeField(local, remote);
      
      expect(result).toEqual({
        value: 'remote',
        hlc: '1000-10',
        hadConflict: true,
        losingValue: 'local',
        losingHlc: '1000-5',
      });
    });
  });

  describe('mergeRecord', () => {
    it('should merge multiple fields', () => {
      const local = {
        name: { value: 'local-name', hlc: '2000-0' },
        age: { value: 25, hlc: '1000-0' },
      };
      
      const remote = {
        name: { value: 'remote-name', hlc: '1000-0' },
        age: { value: 30, hlc: '2000-0' },
        email: { value: 'test@example.com', hlc: '1500-0' },
      };
      
      const result = mergeRecord(local, remote);
      
      expect(result.merged).toEqual({
        name: 'local-name',
        age: 30,
        email: 'test@example.com',
      });
      
      expect(result.conflicts).toHaveLength(2);
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          {
            field: 'name',
            winningValue: 'local-name',
            winningHlc: '2000-0',
            losingValue: 'remote-name',
            losingHlc: '1000-0',
          },
          {
            field: 'age',
            winningValue: 30,
            winningHlc: '2000-0',
            losingValue: 25,
            losingHlc: '1000-0',
          },
        ])
      );
    });

    it('should handle non-conflicting merges', () => {
      const local = {
        name: { value: 'Alice', hlc: '1000-0' },
      };
      
      const remote = {
        email: { value: 'alice@example.com', hlc: '1000-0' },
      };
      
      const result = mergeRecord(local, remote);
      
      expect(result.merged).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
      });
      
      expect(result.conflicts).toHaveLength(0);
    });

    it('should be deterministic - merge(A, B) produces same result as merge(B, A) for winning field', () => {
      const fieldsA = {
        notes: { value: 'A wrote this', hlc: '2000-0' },
      };
      
      const fieldsB = {
        notes: { value: 'B wrote this', hlc: '1000-0' },
      };
      
      const resultAB = mergeRecord(fieldsA, fieldsB);
      const resultBA = mergeRecord(fieldsB, fieldsA);
      
      expect(resultAB.merged.notes).toBe('A wrote this');
      expect(resultBA.merged.notes).toBe('A wrote this');
    });
  });

  describe('convergence properties', () => {
    it('should converge when three replicas merge the same fields', () => {
      const field1 = { value: 'value1', hlc: '1000-0' };
      const field2 = { value: 'value2', hlc: '2000-0' };
      const field3 = { value: 'value3', hlc: '1500-0' };
      
      const merge12 = mergeField(field1, field2);
      const merge23 = mergeField(field2, field3);
      const merge13 = mergeField(field1, field3);
      
      const mergeAll1 = mergeField(merge12, field3);
      const mergeAll2 = mergeField(merge23, field1);
      const mergeAll3 = mergeField(merge13, field2);
      
      expect(mergeAll1?.value).toBe('value2');
      expect(mergeAll2?.value).toBe('value2');
      expect(mergeAll3?.value).toBe('value2');
    });

    it('should be commutative - order of merge does not matter', () => {
      const scenarios = [
        { a: { value: 'A', hlc: '2000-0' }, b: { value: 'B', hlc: '1000-0' } },
        { a: { value: 'A', hlc: '1000-5' }, b: { value: 'B', hlc: '1000-10' } },
        { a: { value: 'A', hlc: '3000-0' }, b: { value: 'B', hlc: '2000-0' } },
      ];
      
      for (const { a, b } of scenarios) {
        const resultAB = mergeField(a, b);
        const resultBA = mergeField(b, a);
        
        expect(resultAB?.value).toBe(resultBA?.value);
        expect(resultAB?.hlc).toBe(resultBA?.hlc);
      }
    });

    it('should be associative - grouping of merges does not matter', () => {
      const f1 = { value: 'v1', hlc: '1000-0' };
      const f2 = { value: 'v2', hlc: '2000-0' };
      const f3 = { value: 'v3', hlc: '1500-0' };
      
      const result1 = mergeField(mergeField(f1, f2), f3);
      const result2 = mergeField(f1, mergeField(f2, f3));
      
      expect(result1?.value).toBe(result2?.value);
    });
  });
});
