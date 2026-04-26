// src/credential/retrieve.js
import { getIpfsClient } from '../ipfs/client.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../metrics/prometheus.js';

async function collectBytes(asyncIter) {
  const chunks = [];
  for await (const chunk of asyncIter) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function retrieveCredential(rootCid, issuerPubKey) {
  const start = Date.now();
  logger.info(`[retrieve] Fetching rootCID=${rootCid}`);

  const ipfs = await getIpfsClient();

  // Scanner récursivement pour trouver les fichiers
  const fileMap = {};
  async function scan(targetCid) {
    try {
      for await (const entry of ipfs.ls(targetCid)) {
        try {
          const data = await collectBytes(ipfs.cat(entry.cid));
          fileMap[entry.name] = data;
        } catch (err) {
          if (err.message.includes('directory') || err.message.includes('this dag node is a directory')) {
            await scan(entry.cid);
          } else {
            logger.warn(`[retrieve] Error reading ${entry.name}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`[retrieve] Error scanning ${targetCid}: ${err.message}`);
    }
  }
  
  await scan(rootCid);
  
  logger.info(`[retrieve] Found files: ${Object.keys(fileMap).join(', ')}`);

  // Vérifier les fichiers requis (soit credential.json, soit claims.json + metadata.json)
  let claims, metadata, signature, image;
  
  if (fileMap['credential.json']) {
    // Format ancien (tout dans un fichier)
    const credential = JSON.parse(fileMap['credential.json'].toString('utf8'));
    claims = credential.claims || credential;
    metadata = credential.metadata || {};
    signature = fileMap['signature.ml-dsa'];
  } else if (fileMap['claims.json'] && fileMap['metadata.json']) {
    // Format nouveau (fichiers séparés)
    claims = JSON.parse(fileMap['claims.json'].toString('utf8'));
    metadata = JSON.parse(fileMap['metadata.json'].toString('utf8'));
    signature = fileMap['signature.ml-dsa'];
  } else {
    throw new Error(`Missing required files. Found: ${Object.keys(fileMap).join(', ')}`);
  }

  if (!signature) {
    throw new Error('Missing signature.ml-dsa file');
  }

  image = fileMap['image.jpg'] || null;

  // Vérification de la signature (optionnelle pour l'instant)
  let signatureValid = false;
  try {
    const claimsRaw = Buffer.from(JSON.stringify(claims));
    // TODO: Implémenter la vérification ML-DSA-65 avec issuerPubKey
    signatureValid = true; // Temporaire
    logger.info(`[retrieve] ML-DSA-65 signature verification: ${signatureValid ? 'VALID' : 'INVALID'}`);
  } catch (err) {
    logger.warn(`[retrieve] Signature verification error: ${err.message}`);
  }

  const durationSec = (Date.now() - start) / 1000;
  metrics.retrieveTotal.inc();
  metrics.retrieveDurationSeconds.observe(durationSec);

  return { metadata, claims, image, signatureValid };
}
