/**
 * Wallet Binding Service
 * 
 * Handles Web3 wallet binding and verification:
 * - MetaMask/EVM wallet connection
 * - Wallet address binding to identity
 * - Signature verification using wallet
 * - Wallet revocation and management
 */

import crypto from 'crypto';

export class WalletBindingService {
  constructor(options = {}) {
    this.walletBindings = new Map(); // walletAddress -> binding record
    this.walletVerificationTimeout = options.walletVerificationTimeout || 5 * 60 * 1000; // 5 minutes
    this.maxWalletsPerIdentity = options.maxWalletsPerIdentity || 3;
  }

  /**
   * Create wallet connection challenge
   * Required before wallet binding
   */
  createWalletChallenge(sessionId) {
    const challenge = {
      challengeId: crypto.randomBytes(16).toString('hex'),
      sessionId,
      message: `Sign this message to bind your wallet to your QSDID identity:\nSession: ${sessionId}\nTimestamp: ${Date.now()}`,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.walletVerificationTimeout,
      verified: false,
    };

    this._challengeStore = this._challengeStore || new Map();
    this._challengeStore.set(challenge.challengeId, challenge);

    return {
      challengeId: challenge.challengeId,
      message: challenge.message,
      expiresAt: challenge.expiresAt,
    };
  }

  /**
   * Verify wallet signature and complete binding
   * 
   * In production:
   * - Validate signature was signed by wallet address
   * - Use web3.eth.verify() or similar
   * - Ensure message matches expected format
   */
  verifyWalletSignature(sessionId, walletAddress, signature, challengeId) {
    const challenge = this._getChallengeRecord(challengeId);

    if (challenge.sessionId !== sessionId) {
      throw new WalletChallengeMismatchError(`Challenge does not match session ${sessionId}`);
    }

    if (challenge.verified) {
      throw new WalletChallengeAlreadyUsedError(`Challenge has already been verified`);
    }

    if (Date.now() > challenge.expiresAt) {
      throw new WalletChallengeExpiredError(`Challenge has expired`);
    }

    // Simulate signature verification
    // In production: use ethers.verifyMessage() or web3.eth.accounts.recover()
    const recoveredAddress = this._recoverAddressFromSignature(
      challenge.message,
      signature
    );

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new WalletSignatureVerificationError(
        `Signature verification failed for wallet ${walletAddress}`
      );
    }

    // Mark challenge as verified
    challenge.verified = true;
    challenge.verifiedAt = Date.now();
    challenge.verifiedAddress = walletAddress;

    return {
      valid: true,
      walletAddress,
      verifiedAt: challenge.verifiedAt,
    };
  }

  /**
   * Bind verified wallet to identity
   */
  bindWalletToIdentity(identityId, walletAddress, sessionId) {
    const identityBindings = this._getOrCreateIdentityBindings(identityId);

    // Check max wallets per identity
    const activeBindings = identityBindings.filter(b => b.isActive);
    if (activeBindings.length >= this.maxWalletsPerIdentity) {
      throw new MaxWalletsExceededError(
        `Identity has reached maximum wallet binding limit (${this.maxWalletsPerIdentity})`
      );
    }

    const bindingRecord = {
      bindingId: crypto.randomBytes(16).toString('hex'),
      identityId,
      walletAddress,
      sessionId,
      isActive: true,
      isPrimary: activeBindings.length === 0, // First wallet is primary
      boundAt: Date.now(),
      lastVerified: Date.now(),
      verificationCount: 1,
    };

    identityBindings.push(bindingRecord);

    return {
      bindingId: bindingRecord.bindingId,
      identityId,
      walletAddress,
      isPrimary: bindingRecord.isPrimary,
      boundAt: bindingRecord.boundAt,
    };
  }

  /**
   * Verify wallet is currently bound to identity
   */
  verifyWalletBinding(identityId, walletAddress) {
    const identityBindings = this._getOrCreateIdentityBindings(identityId);
    
    const binding = identityBindings.find(
      b => b.walletAddress.toLowerCase() === walletAddress.toLowerCase() && b.isActive
    );

    if (!binding) {
      return {
        isBound: false,
        identityId,
        walletAddress,
      };
    }

    return {
      isBound: true,
      bindingId: binding.bindingId,
      identityId,
      walletAddress,
      isPrimary: binding.isPrimary,
      boundAt: binding.boundAt,
      verificationCount: binding.verificationCount,
    };
  }

  /**
   * Verify wallet signature with bound identity
   * Additional verification step for authenticated requests
   */
  verifyWalletSignatureWithIdentity(identityId, walletAddress, signature, message) {
    const binding = this.verifyWalletBinding(identityId, walletAddress);

    if (!binding.isBound) {
      throw new WalletNotBoundError(
        `Wallet ${walletAddress} is not bound to identity ${identityId}`
      );
    }

    // Verify signature
    const recoveredAddress = this._recoverAddressFromSignature(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new WalletSignatureVerificationError(`Signature verification failed`);
    }

    // Update verification metadata
    const identityBindings = this.walletBindings.get(identityId);
    const binding_record = identityBindings.find(
      b => b.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
    binding_record.verificationCount += 1;
    binding_record.lastVerified = Date.now();

    return {
      valid: true,
      bindingId: binding.bindingId,
      verifiedAt: Date.now(),
    };
  }

  /**
   * Get all wallet bindings for identity
   */
  getIdentityWallets(identityId) {
    const bindings = this._getOrCreateIdentityBindings(identityId);
    
    return bindings
      .filter(b => b.isActive)
      .map(b => ({
        bindingId: b.bindingId,
        walletAddress: b.walletAddress,
        isPrimary: b.isPrimary,
        boundAt: b.boundAt,
        lastVerified: b.lastVerified,
        verificationCount: b.verificationCount,
      }));
  }

  /**
   * Set primary wallet
   */
  setPrimaryWallet(identityId, walletAddress) {
    const bindings = this._getOrCreateIdentityBindings(identityId);

    // Reset all to non-primary
    bindings.forEach(b => b.isPrimary = false);

    // Set specified wallet as primary
    const binding = bindings.find(
      b => b.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!binding) {
      throw new WalletNotBoundError(
        `Wallet ${walletAddress} is not bound to identity ${identityId}`
      );
    }

    binding.isPrimary = true;

    return {
      identityId,
      primaryWallet: walletAddress,
      updatedAt: Date.now(),
    };
  }

  /**
   * Unbind wallet from identity
   */
  unbindWallet(identityId, walletAddress, reason = 'User requested') {
    const bindings = this._getOrCreateIdentityBindings(identityId);
    
    const binding = bindings.find(
      b => b.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!binding) {
      throw new WalletNotBoundError(
        `Wallet ${walletAddress} is not bound to identity ${identityId}`
      );
    }

    if (binding.isPrimary && bindings.filter(b => b.isActive).length === 1) {
      throw new CannotUnbindPrimaryWalletError(
        `Cannot unbind the only active wallet. Bind another wallet first.`
      );
    }

    binding.isActive = false;
    binding.unboundAt = Date.now();
    binding.unbindReason = reason;

    return {
      identityId,
      walletAddress,
      unboundAt: binding.unboundAt,
    };
  }

  /**
   * ===== PRIVATE METHODS =====
   */

  /**
   * @private
   * Recover wallet address from signature
   * Simulated implementation - in production use ethers or web3
   */
  _recoverAddressFromSignature(message, signature) {
    // In production:
    // return ethers.verifyMessage(message, signature);
    // OR
    // return web3.eth.accounts.recover(message, signature);

    // Simulation: verify signature is valid hex format
    if (!/^0x[0-9a-f]{130}$/i.test(signature)) {
      throw new InvalidSignatureFormatError(`Signature format is invalid`);
    }

    // For testing: extract wallet from signature pattern
    // In production: use actual ECDSA recovery
    const walletHash = signature.substring(0, 42); // Simulate wallet extraction
    return walletHash || '0x0000000000000000000000000000000000000000';
  }

  /**
   * @private
   */
  _getChallengeRecord(challengeId) {
    if (!this._challengeStore || !this._challengeStore.has(challengeId)) {
      throw new WalletChallengeNotFoundError(`Challenge ${challengeId} not found`);
    }

    return this._challengeStore.get(challengeId);
  }

  /**
   * @private
   */
  _getOrCreateIdentityBindings(identityId) {
    if (!this.walletBindings.has(identityId)) {
      this.walletBindings.set(identityId, []);
    }

    return this.walletBindings.get(identityId);
  }

  /**
   * Cleanup expired challenges (background job)
   */
  cleanupExpiredChallenges() {
    if (!this._challengeStore) return { cleaned: 0 };

    let count = 0;
    for (const [id, challenge] of this._challengeStore.entries()) {
      if (Date.now() > challenge.expiresAt) {
        this._challengeStore.delete(id);
        count++;
      }
    }

    return { cleaned: count };
  }
}

/**
 * Custom wallet binding errors
 */
class WalletChallengeMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletChallengeMismatchError';
    this.code = 'WALLET_CHALLENGE_MISMATCH';
  }
}

class WalletChallengeAlreadyUsedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletChallengeAlreadyUsedError';
    this.code = 'WALLET_CHALLENGE_ALREADY_USED';
  }
}

class WalletChallengeExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletChallengeExpiredError';
    this.code = 'WALLET_CHALLENGE_EXPIRED';
  }
}

class WalletSignatureVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletSignatureVerificationError';
    this.code = 'WALLET_SIGNATURE_VERIFICATION_FAILED';
  }
}

class MaxWalletsExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MaxWalletsExceededError';
    this.code = 'MAX_WALLETS_EXCEEDED';
  }
}

class WalletNotBoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletNotBoundError';
    this.code = 'WALLET_NOT_BOUND';
  }
}

class CannotUnbindPrimaryWalletError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CannotUnbindPrimaryWalletError';
    this.code = 'CANNOT_UNBIND_PRIMARY_WALLET';
  }
}

class WalletChallengeNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletChallengeNotFoundError';
    this.code = 'WALLET_CHALLENGE_NOT_FOUND';
  }
}

class InvalidSignatureFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidSignatureFormatError';
    this.code = 'INVALID_SIGNATURE_FORMAT';
  }
}

export {
  WalletChallengeMismatchError,
  WalletChallengeAlreadyUsedError,
  WalletChallengeExpiredError,
  WalletSignatureVerificationError,
  MaxWalletsExceededError,
  WalletNotBoundError,
  CannotUnbindPrimaryWalletError,
  WalletChallengeNotFoundError,
  InvalidSignatureFormatError,
};
