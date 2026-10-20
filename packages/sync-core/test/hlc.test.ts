import { describe, it, expect } from 'vitest';
import {
  createHLCState,
  tick,
  receive,
  compare,
  parseHLC,
  formatHLC,
  clampFuture,
  type HLC,
} from '../src/hlc.js';

describe('HLC', () => {
  describe('parseHLC and formatHLC', () => {
    it('should parse and format HLC strings correctly', () => {
      const hlc: HLC = { logicalTime: 1234567890, counter: 5 };
      const formatted = formatHLC(hlc);
      expect(formatted).toBe('1234567890-5');
      
      const parsed = parseHLC(formatted);
      expect(parsed).toEqual(hlc);
    });

    it('should throw on invalid HLC format', () => {
      expect(() => parseHLC('invalid')).toThrow('Invalid HLC format');
      expect(() => parseHLC('123')).toThrow('Invalid HLC format');
      expect(() => parseHLC('abc-def')).toThrow('Invalid HLC format');
    });
  });

  describe('tick', () => {
    it('should advance logicalTime when wall clock is ahead', () => {
      const state = createHLCState();
      state.logicalTime = 1000;
      state.counter = 5;
      
      const hlc = tick(state, 2000);
      
      expect(hlc.logicalTime).toBe(2000);
      expect(hlc.counter).toBe(0);
      expect(state.logicalTime).toBe(2000);
      expect(state.counter).toBe(0);
    });

    it('should increment counter when wall clock equals logicalTime', () => {
      const state = createHLCState();
      state.logicalTime = 1000;
      state.counter = 5;
      
      const hlc = tick(state, 1000);
      
      expect(hlc.logicalTime).toBe(1000);
      expect(hlc.counter).toBe(6);
      expect(state.counter).toBe(6);
    });

    it('should handle wall clock behind logicalTime', () => {
      const state = createHLCState();
      state.logicalTime = 2000;
      state.counter = 3;
      
      const hlc = tick(state, 1000);
      
      expect(hlc.logicalTime).toBe(2000);
      expect(hlc.counter).toBe(4);
    });

    it('should generate monotonically increasing timestamps', () => {
      const state = createHLCState();
      const hlcs: HLC[] = [];
      
      for (let i = 0; i < 100; i++) {
        hlcs.push(tick(state, 1000));
      }
      
      for (let i = 1; i < hlcs.length; i++) {
        expect(compare(hlcs[i], hlcs[i - 1])).toBe(1);
      }
    });
  });

  describe('receive', () => {
    it('should update state based on remote timestamp ahead of local', () => {
      const state = createHLCState();
      state.logicalTime = 1000;
      state.counter = 5;
      
      const remote: HLC = { logicalTime: 2000, counter: 10 };
      const hlc = receive(state, remote, 1500);
      
      expect(hlc.logicalTime).toBe(2000);
      expect(hlc.counter).toBe(11);
    });

    it('should handle remote timestamp behind local', () => {
      const state = createHLCState();
      state.logicalTime = 2000;
      state.counter = 5;
      
      const remote: HLC = { logicalTime: 1000, counter: 3 };
      const hlc = receive(state, remote, 1500);
      
      expect(hlc.logicalTime).toBe(2000);
      expect(hlc.counter).toBe(6);
    });

    it('should handle concurrent events at same logicalTime', () => {
      const state = createHLCState();
      state.logicalTime = 1000;
      state.counter = 5;
      
      const remote: HLC = { logicalTime: 1000, counter: 8 };
      const hlc = receive(state, remote, 900);
      
      expect(hlc.logicalTime).toBe(1000);
      expect(hlc.counter).toBe(9);
    });

    it('should use wall clock when ahead of both', () => {
      const state = createHLCState();
      state.logicalTime = 1000;
      state.counter = 5;
      
      const remote: HLC = { logicalTime: 1500, counter: 3 };
      const hlc = receive(state, remote, 2000);
      
      expect(hlc.logicalTime).toBe(2000);
      expect(hlc.counter).toBe(0);
    });
  });

  describe('compare', () => {
    it('should compare HLCs by logicalTime first', () => {
      const a: HLC = { logicalTime: 1000, counter: 10 };
      const b: HLC = { logicalTime: 2000, counter: 5 };
      
      expect(compare(a, b)).toBe(-1);
      expect(compare(b, a)).toBe(1);
    });

    it('should compare HLCs by counter when logicalTime is equal', () => {
      const a: HLC = { logicalTime: 1000, counter: 5 };
      const b: HLC = { logicalTime: 1000, counter: 10 };
      
      expect(compare(a, b)).toBe(-1);
      expect(compare(b, a)).toBe(1);
    });

    it('should return 0 for equal HLCs', () => {
      const a: HLC = { logicalTime: 1000, counter: 5 };
      const b: HLC = { logicalTime: 1000, counter: 5 };
      
      expect(compare(a, b)).toBe(0);
    });

    it('should compare HLC strings', () => {
      expect(compare('1000-5', '2000-3')).toBe(-1);
      expect(compare('1000-10', '1000-5')).toBe(1);
      expect(compare('1000-5', '1000-5')).toBe(0);
    });
  });

  describe('clampFuture', () => {
    it('should not clamp HLCs within acceptable drift', () => {
      const now = Date.now();
      const hlc: HLC = { logicalTime: now + 60000, counter: 5 }; // 1 min ahead
      
      const { clamped, wasClamped } = clampFuture(hlc, now);
      
      expect(wasClamped).toBe(false);
      expect(clamped).toEqual(hlc);
    });

    it('should clamp HLCs more than 5 minutes in the future', () => {
      const now = Date.now();
      const hlc: HLC = { logicalTime: now + 10 * 60 * 1000, counter: 5 }; // 10 min ahead
      
      const { clamped, wasClamped } = clampFuture(hlc, now);
      
      expect(wasClamped).toBe(true);
      expect(clamped.logicalTime).toBe(now + 5 * 60 * 1000);
      expect(clamped.counter).toBe(5);
    });
  });

  describe('convergence property', () => {
    it('should converge when multiple replicas receive same events', () => {
      const state1 = createHLCState();
      const state2 = createHLCState();
      
      const event1 = tick(state1, 1000);
      const event2 = tick(state2, 1000);
      
      receive(state1, event2, 1001);
      receive(state2, event1, 1001);
      
      const finalA = tick(state1, 1002);
      const finalB = tick(state2, 1002);
      
      expect(finalA.logicalTime).toBeGreaterThanOrEqual(finalB.logicalTime - 1);
      expect(finalB.logicalTime).toBeGreaterThanOrEqual(finalA.logicalTime - 1);
    });
  });
});
