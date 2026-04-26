import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storeCredential } from '../credential/store.js';
import { retrieveCredential } from '../credential/retrieve.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/store', async (req, res) => {
  try {
    const { claims, metadata, signature, image } = req.body;
    
    if (!claims || !metadata || !signature) {
      return res.status(400).json({ 
        error: 'Missing required fields: claims, metadata, signature',
        received: { claims: !!claims, metadata: !!metadata, signature: !!signature }
      });
    }
    
    const credentialId = metadata.credentialId || uuidv4();
    const imageBuffer = image ? Buffer.from(image, 'base64') : null;
    const signatureBuffer = Buffer.from(signature, 'base64');
    
    logger.info(`[store] Processing credential ${credentialId}`);
    
    const result = await storeCredential({
      credentialId,
      claims,
      image: imageBuffer,
      metadata: { ...metadata, credentialId },
      signature: signatureBuffer,
    });
    
    return res.status(201).json({
      success: true,
      credentialId,
      rootCid: result.rootCid,
    });
  } catch (err) {
    logger.error(`[POST /store] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/retrieve/:rootCid', async (req, res) => {
  try {
    const { rootCid } = req.params;
    const { issuerPubKey } = req.query;
    
    if (!issuerPubKey) {
      return res.status(400).json({ error: 'Missing query param: issuerPubKey (hex)' });
    }
    
    const pubKeyBuffer = Buffer.from(issuerPubKey, 'hex');
    const credential = await retrieveCredential(rootCid, pubKeyBuffer);
    
    return res.json({
      success: true,
      rootCid,
      ...credential,
      image: credential.image ? credential.image.toString('base64') : null,
    });
  } catch (err) {
    logger.error(`[GET /retrieve] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
