import { describe, it, expect } from 'vitest';
import { mergeField, type FieldValue } from '../src/merge';

describe('merge with device-id tie-break', () => {
  it('should use device-id tie-break when HLCs are equal', () => {
    const localField: FieldValue = {
      value: 'local-value',
      hlc: '1000-5',
    };

    const remoteField: FieldValue = {
      value: 'remote-value',
      hlc: '1000-5',
    };

    const resultWithLocalDevice = mergeField(localField, remoteField, 'device-aaa', 'device-zzz');
    expect(resultWithLocalDevice?.value).toBe('local-value');

    const resultWithRemoteDevice = mergeField(localField, remoteField, 'device-zzz', 'device-aaa');
    expect(resultWithRemoteDevice?.value).toBe('remote-value');
  });

  it('should be deterministic regardless of merge order', () => {
    const fieldA: FieldValue = { value: 'A', hlc: '1000-5' };
    const fieldB: FieldValue = { value: 'B', hlc: '1000-5' };

    const resultAB = mergeField(fieldA, fieldB, 'device-a', 'device-b');
    const resultBA = mergeField(fieldB, fieldA, 'device-b', 'device-a');

    expect(resultAB?.value).toBe(resultBA?.value);
  });
});
