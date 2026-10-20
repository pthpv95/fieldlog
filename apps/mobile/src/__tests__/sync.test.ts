import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { sync, getSyncStatus } from '../sync/client';

global.fetch = jest.fn();

jest.mock('../db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve()),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        onConflictDoUpdate: jest.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

describe('Sync Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getSyncStatus', () => {
    it('should return idle status initially', () => {
      const status = getSyncStatus();
      expect(status.state).toBe('idle');
    });
  });

  describe('sync', () => {
    it('should push and pull successfully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            changes: [],
            nextCursor: null,
            hasMore: false,
          }),
        });

      const result = await sync('http://localhost:3001', 'device-123');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle push endpoint errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await sync('http://localhost:3001', 'device-123');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Push failed');
    });

    it('should handle pull endpoint errors', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const result = await sync('http://localhost:3001', 'device-123');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Pull failed');
    });

    it('should prevent concurrent syncs', async () => {
      (global.fetch as jest.Mock)
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const promise1 = sync('http://localhost:3001', 'device-123');
      const promise2 = sync('http://localhost:3001', 'device-123');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('sync_in_progress');
    });

    it('should call push endpoint with correct format', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            changes: [],
            nextCursor: null,
            hasMore: false,
          }),
        });

      await sync('http://localhost:3001', 'device-123', 1);

      const pushCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(pushCall[0]).toBe('http://localhost:3001/sync/push');
      expect(pushCall[1].method).toBe('POST');
      
      const body = JSON.parse(pushCall[1].body);
      expect(body.deviceId).toBe('device-123');
      expect(body.schemaVersion).toBe(1);
      expect(body.mutations).toEqual([]);
    });

    it('should call pull endpoint with correct format', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            changes: [],
            nextCursor: null,
            hasMore: false,
          }),
        });

      await sync('http://localhost:3001', 'device-123');

      const pullCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(pullCall[0]).toBe('http://localhost:3001/sync/pull');
      expect(pullCall[1].method).toBe('POST');
      
      const body = JSON.parse(pullCall[1].body);
      expect(body.cursor).toBeNull();
      expect(body.limit).toBe(500);
    });
  });
});
