// src/credential/store.js
import { getIpfsClient } from '../ipfs/client.js';
import { enqueueCid } from '../provider/cidQueue.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../metrics/prometheus.js';
import { config } from '../config.js';

export async function storeCredential({ credentialId, claims, image, metadata, signature }) {
  const start = Date.now();
  logger.info(`[store] Storing credential ${credentialId}`);

  const ipfs = await getIpfsClient();

  // Construire les fichiers - Version corrigée qui accepte claims et metadata séparément
  const files = {
    'claims.json': Buffer.from(JSON.stringify(claims, null, 2)),
    'metadata.json': Buffer.from(JSON.stringify(metadata, null, 2)),
    'signature.ml-dsa': signature,
  };

  if (image) {
    files['image.jpg'] = image;
  }

  const addOptions = {
    cidVersion: config.ipfs.cidVersion || 1,
    hashAlg: config.ipfs.hashAlgo || 'sha2-256',
    wrapWithDirectory: true,
    pin: true,
  };

  const addSource = Object.entries(files).map(([name, content]) => ({
    path: name,
    content: content,
  }));

  let rootCid = null;
  for await (const result of ipfs.addAll(addSource, addOptions)) {
    logger.info(`[store] Add result: path="${result.path}" CID=${result.cid.toString()}`);
    rootCid = result.cid.toString();
  }

  if (!rootCid) {
    throw new Error(`[store] Could not determine root CID for credential ${credentialId}`);
  }

  logger.info(`[store] Credential stored. rootCID=${rootCid}`, { credentialId });

  await enqueueCid(rootCid);

  const durationSec = (Date.now() - start) / 1000;
  metrics.storeTotal.inc();
  metrics.storeDurationSeconds.observe(durationSec);

  return { rootCid, credentialId };
}
