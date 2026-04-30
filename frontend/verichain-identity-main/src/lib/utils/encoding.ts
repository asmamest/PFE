import bs58 from 'bs58';

export function hexToMultibase(hex: string): string {
  if (!hex || typeof hex !== 'string') {
    throw new Error('hexToMultibase: input must be a non-empty hex string');
  }
  const clean = hex.replace(/^0x/, '');
  if (clean.length % 2 !== 0) {
    throw new Error('hexToMultibase: invalid hex length');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const byteHex = clean.substr(i, 2);
    bytes[i / 2] = parseInt(byteHex, 16);
  }
  const base58 = bs58.encode(bytes);
  return `z${base58}`;
}