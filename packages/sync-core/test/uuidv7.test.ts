import { describe, it, expect } from 'vitest';

describe('UUIDv7 variant bits', () => {
  function parseUUID(uuid: string): { version: number; variant: number } {
    const hex = uuid.replace(/-/g, '');
    const versionNibble = parseInt(hex[12], 16);
    const variantByte = parseInt(hex.substring(16, 18), 16);
    
    return {
      version: versionNibble >> 0,
      variant: (variantByte & 0b11000000) >> 6,
    };
  }

  it('should set version 7 in the version field', () => {
    const uuid = generateUUIDv7();
    const parsed = parseUUID(uuid);
    
    expect(parsed.version).toBeGreaterThanOrEqual(7);
    expect(parsed.version).toBeLessThan(8);
  });

  it('should set RFC 4122 variant (10xx in bits)', () => {
    const uuid = generateUUIDv7();
    const parsed = parseUUID(uuid);
    
    expect(parsed.variant).toBe(2);
  });
});

function generateUUIDv7(): string {
  const timestamp = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));
  
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  
  randomBytes[0] = (randomBytes[0] & 0x0f) | 0x70;
  randomBytes[2] = (randomBytes[2] & 0x3f) | 0x80;
  
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 20)}`;
}
