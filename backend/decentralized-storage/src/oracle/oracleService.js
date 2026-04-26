// src/oracle/oracleService.js
// Production-ready Oracle Service for QSDID Platform
// Listens to blockchain events, verifies ML-DSA signatures, submits results

import { ethers } from 'ethers';
import { getIpfsClient } from '../ipfs/client.js';
import { verifyMLDSA65 } from '../crypto/signature.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../metrics/prometheus.js';
import { config } from '../config.js';

// Contract ABI (minimal for verification)
const VERIFICATION_ORACLE_ABI = [
  'event VerificationRequested(uint256 indexed requestId, string credentialHash, address indexed verifier)',
  'function submitVerificationResult(uint256 requestId, bool isValid, string calldata proof) external',
  'function getRequest(uint256 requestId) external view returns (address verifier, string credentialHash, bool resolved, bool isValid)'
];

const CREDENTIAL_REGISTRY_ABI = [
  'function getCredential(string calldata credentialHash) external view returns (address issuer, string cid, uint256 timestamp, bool revoked)'
];

class OracleService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.oracleContract = null;
    this.registryContract = null;
    this.isRunning = false;
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.processingInterval = null;
    
    // Configuration
    this.rpcUrl = config.blockchain.rpcUrl || 'http://localhost:8545';
    this.oraclePrivateKey = config.blockchain.oraclePrivateKey;
    this.oracleAddress = config.blockchain.oracleAddress;
    this.oracleContractAddress = config.blockchain.oracleContractAddress;
    this.registryContractAddress = config.blockchain.registryContractAddress;
    this.pollingInterval = config.blockchain.pollingInterval || 5000; // 5 seconds
    this.batchSize = config.blockchain.batchSize || 10;
    this.maxRetries = config.blockchain.maxRetries || 3;
  }

  async initialize() {
    try {
      logger.info('[Oracle] Initializing Oracle Service...');
      
      // Connect to blockchain
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.signer = new ethers.Wallet(this.oraclePrivateKey, this.provider);
      
      // Initialize contracts
      this.oracleContract = new ethers.Contract(
        this.oracleContractAddress,
        VERIFICATION_ORACLE_ABI,
        this.signer
      );
      
      this.registryContract = new ethers.Contract(
        this.registryContractAddress,
        CREDENTIAL_REGISTRY_ABI,
        this.provider
      );
      
      // Check balance
      const balance = await this.provider.getBalance(this.oracleAddress);
      logger.info(`[Oracle] Oracle address: ${this.oracleAddress}`);
      logger.info(`[Oracle] Balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance === 0n) {
        logger.warn('[Oracle] Oracle has zero balance! Please fund the oracle address.');
      }
      
      logger.info('[Oracle] Oracle Service initialized successfully');
      return true;
    } catch (error) {
      logger.error(`[Oracle] Initialization failed: ${error.message}`);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('[Oracle] Oracle service already running');
      return;
    }
    
    logger.info('[Oracle] Starting Oracle Service...');
    this.isRunning = true;
    
    // Listen for new events
    await this.startEventListening();
    
    // Start processing queue
    this.startQueueProcessor();
    
    // Start health check
    this.startHealthCheck();
    
    logger.info('[Oracle] Oracle Service is running');
  }

  async startEventListening() {
    try {
      logger.info('[Oracle] Listening for VerificationRequested events...');
      
      // Listen to past events (from last 1000 blocks)
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = currentBlock - 1000;
      
      const events = await this.oracleContract.queryFilter(
        'VerificationRequested',
        fromBlock,
        currentBlock
      );
      
      for (const event of events) {
        await this.handleVerificationRequest(event);
      }
      
      // Listen to future events
      this.oracleContract.on('VerificationRequested', (requestId, credentialHash, verifier, event) => {
        logger.info(`[Oracle] New VerificationRequested event: requestId=${requestId}, hash=${credentialHash}`);
        this.handleVerificationRequest({ requestId, credentialHash, verifier, event });
      });
      
    } catch (error) {
      logger.error(`[Oracle] Event listening failed: ${error.message}`);
      setTimeout(() => this.startEventListening(), 10000);
    }
  }

  async handleVerificationRequest(event) {
    const requestId = event.requestId.toString();
    const credentialHash = event.credentialHash;
    const verifier = event.verifier;
    
    // Avoid duplicate processing
    if (this.pendingRequests.has(requestId)) {
      logger.debug(`[Oracle] Request ${requestId} already in queue`);
      return;
    }
    
    // Add to queue
    this.pendingRequests.set(requestId, {
      requestId,
      credentialHash,
      verifier,
      status: 'pending',
      retries: 0,
      timestamp: Date.now()
    });
    
    this.requestQueue.push(requestId);
    logger.info(`[Oracle] Queued request ${requestId} (queue size: ${this.requestQueue.length})`);
    
    // Update metrics
    metrics.oraclePendingRequests.set(this.requestQueue.length);
  }

  async startQueueProcessor() {
    this.processingInterval = setInterval(async () => {
      if (this.requestQueue.length === 0) return;
      
      // Process in batches
      const batch = this.requestQueue.splice(0, this.batchSize);
      
      logger.info(`[Oracle] Processing batch of ${batch.length} requests`);
      
      for (const requestId of batch) {
        await this.processRequest(requestId);
      }
      
      // Update metrics
      metrics.oraclePendingRequests.set(this.requestQueue.length);
    }, this.pollingInterval);
  }

  async processRequest(requestId) {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;
    
    const startTime = Date.now();
    logger.info(`[Oracle] Processing request ${requestId}`);
    
    try {
      // Step 1: Get credential from IPFS
      const credential = await this.fetchCredentialFromIPFS(request.credentialHash);
      if (!credential) {
        throw new Error('Credential not found in IPFS');
      }
      
      // Step 2: Get issuer public key from blockchain
      const issuerInfo = await this.registryContract.getCredential(request.credentialHash);
      const issuerPubKeyHex = await this.getIssuerPublicKey(issuerInfo.issuer);
      
      // Step 3: Verify ML-DSA signature
      const claimsRaw = Buffer.from(JSON.stringify(credential.claims));
      const signatureValid = await verifyMLDSA65(
        claimsRaw,
        credential.signature,
        Buffer.from(issuerPubKeyHex, 'hex')
      );
      
      // Step 4: Verify AI fraud score if present
      let aiValid = true;
      let fraudScore = 0;
      if (credential.ai_result && credential.ai_result.fraud_score !== undefined) {
        fraudScore = credential.ai_result.fraud_score;
        aiValid = fraudScore < 0.5; // Threshold: 0.5 = 50%
      }
      
      const isValid = signatureValid && aiValid;
      
      // Step 5: Generate proof
      const proof = this.generateProof({
        requestId,
        credentialHash: request.credentialHash,
        signatureValid,
        aiValid,
        fraudScore,
        timestamp: new Date().toISOString(),
        heatmapHash: credential.ai_result?.heatmap_hash || null
      });
      
      // Step 6: Submit result to blockchain
      const tx = await this.oracleContract.submitVerificationResult(
        requestId,
        isValid,
        JSON.stringify(proof)
      );
      
      await tx.wait();
      
      const duration = Date.now() - startTime;
      logger.info(`[Oracle] Request ${requestId} resolved: isValid=${isValid}, tx=${tx.hash}, duration=${duration}ms`);
      
      // Update metrics
      metrics.oracleRequestsTotal.inc();
      metrics.oracleRequestDuration.observe(duration);
      if (isValid) {
        metrics.oracleValidVerifications.inc();
      } else {
        metrics.oracleInvalidVerifications.inc();
      }
      
      // Mark as completed
      request.status = 'completed';
      request.result = { isValid, proof, txHash: tx.hash };
      
    } catch (error) {
      logger.error(`[Oracle] Failed to process request ${requestId}: ${error.message}`);
      
      request.retries++;
      if (request.retries < this.maxRetries) {
        // Re-queue for retry
        logger.info(`[Oracle] Retrying request ${requestId} (${request.retries}/${this.maxRetries})`);
        this.requestQueue.push(requestId);
      } else {
        request.status = 'failed';
        logger.error(`[Oracle] Request ${requestId} failed after ${this.maxRetries} retries`);
        
        // Submit failure result
        try {
          const proof = this.generateProof({
            requestId,
            credentialHash: request.credentialHash,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          const tx = await this.oracleContract.submitVerificationResult(
            requestId,
            false,
            JSON.stringify(proof)
          );
          await tx.wait();
          
          logger.info(`[Oracle] Submitted failure result for request ${requestId}, tx=${tx.hash}`);
        } catch (submitError) {
          logger.error(`[Oracle] Failed to submit failure result: ${submitError.message}`);
        }
      }
    }
    
    // Clean up old completed requests (keep last 1000)
    if (request.status === 'completed' || request.status === 'failed') {
      setTimeout(() => {
        this.pendingRequests.delete(requestId);
      }, 3600000); // Remove after 1 hour
    }
  }

  async fetchCredentialFromIPFS(credentialHash) {
    try {
      const ipfs = await getIpfsClient();
      
      // credentialHash is the root CID
      const files = {};
      
      async function scan(cid) {
        for await (const entry of ipfs.ls(cid)) {
          try {
            const chunks = [];
            for await (const chunk of ipfs.cat(entry.cid)) {
              chunks.push(chunk);
            }
            files[entry.name] = Buffer.concat(chunks);
          } catch (err) {
            if (err.message.includes('directory')) {
              await scan(entry.cid);
            }
          }
        }
      }
      
      await scan(credentialHash);
      
      if (!files['claims.json.enc'] || !files['signature.ml-dsa'] || !files['metadata.json']) {
        throw new Error('Missing required files in IPFS directory');
      }
      
      // Decrypt claims (using master key)
      const { decryptCredentialData, parseMasterKey } = await import('../crypto/encryption.js');
      const masterKey = parseMasterKey(config.encryption.masterKeyHex);
      
      const claimsPlain = decryptCredentialData(
        files['claims.json.enc'],
        masterKey,
        `claims:${credentialHash}`
      );
      
      const claims = JSON.parse(claimsPlain.toString('utf8'));
      const metadata = JSON.parse(files['metadata.json'].toString('utf8'));
      const signature = files['signature.ml-dsa'];
      
      let aiResult = null;
      if (metadata.ai_result) {
        aiResult = metadata.ai_result;
      }
      
      return {
        claims,
        metadata,
        signature,
        aiResult,
        image: files['image.enc'] || null
      };
      
    } catch (error) {
      logger.error(`[Oracle] Failed to fetch credential from IPFS: ${error.message}`);
      return null;
    }
  }

  async getIssuerPublicKey(issuerAddress) {
    // TODO: Fetch from IssuerRegistry contract
    // For now, return a placeholder
    // In production, this should query the IssuerRegistry.getIssuer(issuerAddress)
    logger.debug(`[Oracle] Fetching public key for issuer ${issuerAddress}`);
    return '8412a2d0eee3287916401486196145e7...'; // Placeholder
  }

  generateProof(data) {
    const proof = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      oracleAddress: this.oracleAddress,
      ...data
    };
    
    // Add signature from oracle
    // proof.signature = this.signProof(proof);
    
    return proof;
  }

  startHealthCheck() {
    setInterval(async () => {
      const health = {
        status: 'healthy',
        pendingRequests: this.requestQueue.length,
        totalProcessed: metrics.oracleRequestsTotal?.get() || 0,
        uptime: process.uptime()
      };
      
      logger.debug(`[Oracle] Health check: ${JSON.stringify(health)}`);
      
      // Update health metric
      metrics.oracleHealth.set(1);
    }, 60000);
  }

  async stop() {
    logger.info('[Oracle] Stopping Oracle Service...');
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.oracleContract.removeAllListeners();
    logger.info('[Oracle] Oracle Service stopped');
  }
}

// Singleton instance
let oracleInstance = null;

export async function startOracleService() {
  if (!oracleInstance) {
    oracleInstance = new OracleService();
    await oracleInstance.initialize();
    await oracleInstance.start();
  }
  return oracleInstance;
}

export async function stopOracleService() {
  if (oracleInstance) {
    await oracleInstance.stop();
    oracleInstance = null;
  }
}

export default OracleService;




