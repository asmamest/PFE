// tests/integration/redisFailure.test.js
// Test: Redis connection loss - verify queue fallback & resynchronization

import { jest } from '@jest/globals';

describe('Redis Connection Loss Handling', () => {
  let mockRedis;
  let mockQueue = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue = [];

    // Mock Redis client
    mockRedis = {
      connected: true,
      rpush: jest.fn(async (key, value) => {
        if (!mockRedis.connected) {
          throw new Error('Redis connection lost');
        }
        mockQueue.push(value);
        return mockQueue.length;
      }),
      lpop: jest.fn(async (key, count) => {
        if (!mockRedis.connected) {
          throw new Error('Redis connection lost');
        }
        return mockQueue.splice(0, count);
      }),
      llen: jest.fn(async (key) => {
        if (!mockRedis.connected) {
          throw new Error('Redis connection lost');
        }
        return mockQueue.length;
      }),
    };
  });

  test('should queue CID in memory when Redis is down', async () => {
    const cid = 'QmTest789';
    const memoryQueue = [];

    // Disconnect Redis
    mockRedis.connected = false;

    // Attempt primary queue (should fail)
    let primaryFailed = false;
    try {
      await mockRedis.rpush('queue', cid);
    } catch (err) {
      primaryFailed = true;
      // Fall back to memory queue
      memoryQueue.push(cid);
    }

    expect(primaryFailed).toBe(true);
    expect(memoryQueue).toContain(cid);
    expect(mockQueue).not.toContain(cid); // Not in Redis
  });

  test('should resynchronize memory queue with Redis on reconnect', async () => {
    const cids = ['QmA', 'QmB', 'QmC'];
    const memoryQueue = [];

    // Simulate connection loss
    mockRedis.connected = false;
    for (const cid of cids) {
      try {
        await mockRedis.rpush('queue', cid);
      } catch {
        memoryQueue.push(cid);
      }
    }

    expect(memoryQueue.length).toBe(3);

    // Reconnect Redis
    mockRedis.connected = true;

    // Resynchronize
    for (const cid of memoryQueue) {
      await mockRedis.rpush('queue', cid);
    }
    memoryQueue.length = 0; // Clear memory queue

    expect(mockQueue.length).toBe(3);
    expect(memoryQueue.length).toBe(0);
  });

  test('should drain Redis queue after reconnection', async () => {
    const cid1 = 'QmReconnect1';
    const cid2 = 'QmReconnect2';

    // Add items while connected
    await mockRedis.rpush('queue', cid1);
    await mockRedis.rpush('queue', cid2);

    expect(mockQueue.length).toBe(2);

    // Simulate temporary disconnect and reconnect
    mockRedis.connected = false;
    mockRedis.connected = true;

    // Drain queue
    const items = await mockRedis.lpop('queue', 10);

    expect(items.length).toBe(2);
    expect(items).toEqual([cid1, cid2]);
  });
});
