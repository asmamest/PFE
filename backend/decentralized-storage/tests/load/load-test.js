#!/usr/bin/env node
// tests/load/load-test.js
// Load test: add N credentials and measure throughput, DHT lookup count, and persistence.
//
// Usage:
//   IPFS_API_URL=http://localhost:5001 \
//   REDIS_URL=redis://localhost:6379 \
//   LOAD_COUNT=50000 \
//   node tests/load/load-test.js

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { storeCredential } from '../../src/credential/store.js';
import { closeRedis, queueLength } from '../../src/provider/cidQueue.js';
import { logger } from '../../src/utils/logger.js';

const TOTAL   = parseInt(process.env.LOAD_COUNT ?? '1000', 10);
const CONCUR  = parseInt(process.env.CONCURRENCY ?? '20', 10);

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(` QSDID Storage Load Test`);
console.log(` Credentials : ${TOTAL}`);
console.log(` Concurrency : ${CONCUR}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

const start = Date.now();
let stored = 0, errors = 0;

async function runOne() {
  const id  = uuidv4();
  const sig = crypto.randomBytes(64); // mock signature
  try {
    await storeCredential({
      credentialId: id,
      claims:   { name: `User-${id}`, score: Math.random() },
      image:    null,
      metadata: {
        type:      'LoadTestCredential',
        issuerDid: 'did:load:issuer',
        holderDid: `did:load:${id}`,
      },
      signature: sig,
    });
    stored++;
  } catch (err) {
    errors++;
    logger.warn(`[load] Error storing ${id}: ${err.message}`);
  }
}

// Semaphore: run CONCUR tasks at a time
const queue = Array.from({ length: TOTAL }, (_, i) => i);

async function worker() {
  while (queue.length) {
    queue.pop(); // consume one slot
    await runOne();

    // Progress log every 500
    if (stored % 500 === 0 && stored > 0) {
      const elapsed  = (Date.now() - start) / 1000;
      const rate     = (stored / elapsed).toFixed(1);
      const pending  = await queueLength();
      console.log(`  ✔ Stored: ${stored}/${TOTAL} | ${rate} creds/s | Pending CIDs: ${pending}`);
    }
  }
}

// Spawn workers
await Promise.all(Array.from({ length: CONCUR }, worker));

const totalSec   = (Date.now() - start) / 1000;
const throughput = (stored / totalSec).toFixed(1);
const pendingQ   = await queueLength();

console.log('');
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(` Load Test Complete`);
console.log(`  Stored      : ${stored}`);
console.log(`  Errors      : ${errors}`);
console.log(`  Duration    : ${totalSec.toFixed(2)}s`);
console.log(`  Throughput  : ${throughput} credentials/second`);
console.log(`  Pending CIDs: ${pendingQ}`);
console.log(`  Target      : ≥ 2.77 creds/s (10,000/h)`);
console.log(`  Status      : ${throughput >= 2.77 ? '✔ PASS' : '✗ FAIL'}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

await closeRedis();
