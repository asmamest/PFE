// tests/integration/ipfsFailure.test.js
// Test: IPFS node failure - simulate 2 nodes down, verify 3rd responds

import { jest } from '@jest/globals';
import fetch from 'node-fetch';

// Mock node URLs
const NODES = [
  'http://node1:5001',
  'http://node2:5001',  
  'http://node3:5001',
];

describe('IPFS Node Failure Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should retrieve CID from healthy node when 2 nodes are down', async () => {
    const cid = 'QmTest123';
    let nodeAttempts = 0;

    // Mock fetch to simulate 2 nodes down, 1 healthy
    global.fetch = jest.fn((url) => {
      nodeAttempts += 1;

      if (url.includes('node1') || url.includes('node2')) {
        // Node 1 and 2 are down
        return Promise.reject(new Error('Connection refused'));
      }

      if (url.includes('node3')) {
        // Node 3 is healthy
        return Promise.resolve({
          ok: true,
          json: async () => ({ Pins: [cid] }),
        });
      }

      return Promise.reject(new Error('Unknown node'));
    });

    const results = await Promise.allSettled(
      NODES.map((nodeUrl) =>
        fetch(`${nodeUrl}/api/v0/pin/ls?arg=${cid}`).then((res) => res.json())
      )
    );

    const healthyResults = results.filter((r) => r.status === 'fulfilled');
    expect(healthyResults.length).toBe(1);
    expect(nodeAttempts).toBe(3);
  });

  test('should report replication factor when only 1/3 nodes responds', async () => {
    const cid = 'QmTest456';
    let succeededCount = 0;

    global.fetch = jest.fn((url) => {
      if (url.includes('node3')) {
        succeededCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ Pins: [cid] }),
        });
      }
      return Promise.reject(new Error('Node down'));
    });

    const results = await Promise.allSettled(
      NODES.map((nodeUrl) =>
        fetch(`${nodeUrl}/api/v0/pin/add?arg=${cid}`).then((res) => res.json())
      )
    );

    const replicationFactor = succeededCount / NODES.length;
    expect(replicationFactor).toBe(1 / 3);
    expect(replicationFactor).toBeCloseTo(0.333, 2);
  });
});
