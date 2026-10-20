import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  generateUUIDv7,
  createInspection,
  updateInspection,
  createObservation,
} from '../repositories/inspections';

jest.mock('../db', () => ({
  db: {
    transaction: jest.fn((fn) => fn(mockTx)),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])),
        })),
        orderBy: jest.fn(() => Promise.resolve([])),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => Promise.resolve({ id: 'test-id' })),
      onConflictDoUpdate: jest.fn(() => Promise.resolve()),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

const mockTx = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve([
          {
            id: 'test-id',
            version: 1,
            fieldClocks: '{}',
            notes: null,
            overallScore: null,
          },
        ])),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => Promise.resolve({ id: 'test-id' })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    })),
  })),
};

describe('Inspections Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUUIDv7', () => {
    it('should generate a valid UUIDv7 format', () => {
      const uuid = generateUUIDv7();
      
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUIDv7();
      const uuid2 = generateUUIDv7();
      
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('createInspection', () => {
    it('should create inspection and outbox entry in a transaction', async () => {
      const input = {
        blockId: 'block-123',
        inspectorId: 'inspector-456',
        orgId: 'org-789',
      };

      await createInspection(input);

      expect(mockTx.insert).toHaveBeenCalledTimes(2);
    });

    it('should set default status to DRAFT', async () => {
      const input = {
        blockId: 'block-123',
        inspectorId: 'inspector-456',
        orgId: 'org-789',
      };

      await createInspection(input);

      const insertCall = (mockTx.insert as jest.Mock).mock.calls[0];
      expect(insertCall).toBeDefined();
    });
  });

  describe('updateInspection', () => {
    it('should update inspection fields and create outbox entry', async () => {
      const input = {
        id: 'test-id',
        notes: 'Updated notes',
        overallScore: 85,
      };

      await updateInspection(input);

      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should set syncState to pending after update', async () => {
      const input = {
        id: 'test-id',
        notes: 'Updated notes',
      };

      await updateInspection(input);

      const updateCall = (mockTx.update as jest.Mock).mock.calls[0];
      expect(updateCall).toBeDefined();
    });
  });

  describe('createObservation', () => {
    it('should create observation with outbox entry', async () => {
      const input = {
        inspectionId: 'inspection-123',
        kind: 'PEST' as const,
        code: 'PEST-001',
        severity: 3,
        note: 'Test observation',
      };

      await createObservation(input);

      expect(mockTx.insert).toHaveBeenCalledTimes(2);
    });

    it('should set dependsOn to inspectionId', async () => {
      const input = {
        inspectionId: 'inspection-123',
        kind: 'PEST' as const,
        code: 'PEST-001',
      };

      await createObservation(input);

      const outboxCall = (mockTx.insert as jest.Mock).mock.calls[1];
      expect(outboxCall).toBeDefined();
    });
  });
});
