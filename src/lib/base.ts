import { defineChain } from 'viem';

// Base mainnet chain config
export const BASE_CHAIN_ID = 8453;

export const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
    public: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
});

export const BASE_RPC_URL = 'https://mainnet.base.org';

// Canonical USDC on Base — never deploy an unaudited token for real value
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = 'USDC';

export const NATIVE_DECIMALS = 18;

export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

// Minimal ERC-20 ABI for balance reads + transfers
export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/** Build a BaseScan transaction URL */
export function txUrl(hash?: string | null): string | null {
  if (!hash) return null;
  return `https://basescan.org/tx/${hash}`;
}

/** Build a BaseScan address URL */
export function addressUrl(address?: string | null): string | null {
  if (!address) return null;
  return `https://basescan.org/address/${address}`;
}

/** Build a BaseScan token holdings URL */
export function tokenUrl(address?: string | null): string | null {
  if (!address) return null;
  return `https://basescan.org/token/${USDC_ADDRESS}?a=${address}`;
}

/**
 * Convert a human-readable USDC amount string to base units (bigint, 6 decimals).
 * Tolerant of trailing/leading whitespace and commas.
 */
export function toUsdcUnits(amount: string | number): bigint {
  const raw = String(amount).trim().replace(/,/g, '');
  if (!raw || isNaN(Number(raw))) return 0n;
  const [whole, frac = ''] = raw.split('.');
  const fracPadded = (frac + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const wholePart = BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS);
  const fracPart = BigInt(fracPadded || '0');
  return wholePart + fracPart;
}

/**
 * Convert base units (bigint or string) to a human-readable decimal string.
 */
export function fromUsdcUnits(units: bigint | string, decimals = USDC_DECIMALS): string {
  const value = typeof units === 'string' ? BigInt(units || '0') : units;
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}

/** Convert wei (native ETH) string/bigint to a trimmed ETH string */
export function fromWei(wei: bigint | string, decimals = NATIVE_DECIMALS): string {
  return fromUsdcUnits(wei, decimals);
}
