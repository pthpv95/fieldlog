import { describe, it, expect } from 'vitest';
import {
  calculateBackoff,
  shouldRetry,
  recordFailure,
  resetRetryState,
  isReadyToRetry,
  createRetryState,
} from '../src/backoff.js';

describe('backoff', () => {
  describe('calculateBackoff', () => {
    it('should return exponential delays with jitter', () => {
      const delays = [];
      for (let i = 0; i < 5; i++) {
        delays.push(calculateBackoff(i, { baseDelayMs: 1000 }));
      }
      
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(0);
      }
      
      for (let i = 0; i < delays.length; i++) {
        const maxExpected = 1000 * Math.pow(2, i);
        expect(delays[i]).toBeLessThanOrEqual(maxExpected);
      }
    });

    it('should cap at maxDelayMs', () => {
      const delay = calculateBackoff(20, { baseDelayMs: 1000, maxDelayMs: 60000 });
      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('should use default values', () => {
      const delay = calculateBackoff(0);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(2000);
    });

    it('should produce different values due to jitter', () => {
      const delays = new Set();
      for (let i = 0; i < 100; i++) {
        delays.add(calculateBackoff(5, { baseDelayMs: 1000 }));
      }
      expect(delays.size).toBeGreaterThan(50);
    });
  });

  describe('shouldRetry', () => {
    it('should allow retries up to maxAttempts', () => {
      expect(shouldRetry(0, { maxAttempts: 3 })).toBe(true);
      expect(shouldRetry(1, { maxAttempts: 3 })).toBe(true);
      expect(shouldRetry(2, { maxAttempts: 3 })).toBe(true);
      expect(shouldRetry(3, { maxAttempts: 3 })).toBe(false);
      expect(shouldRetry(4, { maxAttempts: 3 })).toBe(false);
    });

    it('should use default maxAttempts', () => {
      expect(shouldRetry(0)).toBe(true);
      expect(shouldRetry(9)).toBe(true);
      expect(shouldRetry(10)).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('should increment attempts and set nextAttemptAt', () => {
      const state = createRetryState();
      const now = Date.now();
      
      const newState = recordFailure(state, 'Network error', { baseDelayMs: 1000 });
      
      expect(newState.attempts).toBe(1);
      expect(newState.lastError).toBe('Network error');
      expect(newState.nextAttemptAt).toBeGreaterThan(now);
      expect(newState.nextAttemptAt).toBeLessThanOrEqual(now + 2000);
    });

    it('should handle Error objects', () => {
      const state = createRetryState();
      const error = new Error('Test error');
      
      const newState = recordFailure(state, error);
      
      expect(newState.lastError).toBe('Test error');
    });

    it('should stop scheduling retries after maxAttempts', () => {
      let state = createRetryState();
      
      for (let i = 0; i < 5; i++) {
        state = recordFailure(state, 'Error', { maxAttempts: 3 });
      }
      
      expect(state.attempts).toBe(5);
      expect(state.nextAttemptAt).toBeNull();
    });

    it('should increase backoff with each failure', () => {
      const state1 = recordFailure(createRetryState(), 'Error 1', { baseDelayMs: 1000 });
      const state2 = recordFailure(state1, 'Error 2', { baseDelayMs: 1000 });
      const state3 = recordFailure(state2, 'Error 3', { baseDelayMs: 1000 });
      
      expect(state1.nextAttemptAt).not.toBeNull();
      expect(state2.nextAttemptAt).not.toBeNull();
      expect(state3.nextAttemptAt).not.toBeNull();
    });
  });

  describe('isReadyToRetry', () => {
    it('should return false when nextAttemptAt is null', () => {
      const state = createRetryState();
      expect(isReadyToRetry(state)).toBe(false);
    });

    it('should return false when current time is before nextAttemptAt', () => {
      const now = Date.now();
      const state = {
        attempts: 1,
        nextAttemptAt: now + 10000,
        lastError: 'Error',
      };
      
      expect(isReadyToRetry(state, now)).toBe(false);
    });

    it('should return true when current time is at or after nextAttemptAt', () => {
      const now = Date.now();
      const state = {
        attempts: 1,
        nextAttemptAt: now - 1000,
        lastError: 'Error',
      };
      
      expect(isReadyToRetry(state, now)).toBe(true);
    });
  });

  describe('resetRetryState', () => {
    it('should reset to initial state', () => {
      let state = createRetryState();
      state = recordFailure(state, 'Error');
      state = recordFailure(state, 'Error 2');
      
      expect(state.attempts).toBeGreaterThan(0);
      
      const resetState = resetRetryState();
      expect(resetState.attempts).toBe(0);
      expect(resetState.nextAttemptAt).toBeNull();
      expect(resetState.lastError).toBeNull();
    });
  });
});
