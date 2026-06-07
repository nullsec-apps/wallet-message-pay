import { formatDistanceToNowStrict, format } from 'date-fns';

/** Format a USDC / fiat amount with the given symbol prefix. */
export function formatAmount(
  value: number | string,
  opts: { symbol?: string; maxFractionDigits?: number; minFractionDigits?: number } = {}
): string {
  const { symbol = '', maxFractionDigits = 2, minFractionDigits = 2 } = opts;
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return `${symbol}0.00`;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
  return `${symbol}${formatted}`;
}

/** Format a USDC amount — shows up to 2 decimals, trims when whole. */
export function formatUsdc(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '0';
  if (Number.isInteger(num)) return num.toLocaleString('en-US');
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/** Format a USD fiat value (e.g. gas fee). */
export function formatUsd(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '$0.00';
  if (num > 0 && num < 0.01) {
    return `$${num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  }
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a large number with K / M / B suffixes. */
export function formatCompact(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '0';
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2).replace(/\.?0+$/, '')}B`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1).replace(/\.?0+$/, '')}K`;
  return num.toLocaleString('en-US');
}

/** Format a percentage with one decimal. */
export function formatPercent(value: number | string, decimals = 1): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '0%';
  return `${num.toFixed(decimals)}%`;
}

/** Truncate a 0x address to 0x1234…abcd. */
export function truncateAddress(address?: string | null, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}\u2026${address.slice(-chars)}`;
}

/** Truncate a tx hash to a compact form. */
export function truncateHash(hash?: string | null, chars = 6): string {
  if (!hash) return '';
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}\u2026${hash.slice(-chars)}`;
}

/** Relative time, e.g. '3m ago'. Safe against invalid dates. */
export function relativeTime(date?: string | number | Date | null): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  try {
    return `${formatDistanceToNowStrict(d)} ago`;
  } catch {
    return '';
  }
}

/** Short clock label for message bubbles, e.g. '14:32'. */
export function clockTime(date?: string | number | Date | null): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  try {
    return format(d, 'HH:mm');
  } catch {
    return '';
  }
}

/** Full timestamp for receipt cards, e.g. '12 Jun 2024, 14:32'. */
export function fullTimestamp(date?: string | number | Date | null): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  try {
    return format(d, "d MMM yyyy, HH:mm");
  } catch {
    return '';
  }
}

/** Human label for confirmation seconds, e.g. '3.2s'. */
export function confirmationLabel(seconds?: number | string | null): string {
  if (seconds === null || seconds === undefined) return '\u2014';
  const num = typeof seconds === 'string' ? Number(seconds) : seconds;
  if (isNaN(num)) return '\u2014';
  if (num < 10) return `${num.toFixed(1)}s`;
  if (num < 60) return `${Math.round(num)}s`;
  const mins = Math.floor(num / 60);
  const rem = Math.round(num % 60);
  return `${mins}m ${rem}s`;
}

/** Format block number with thousands separators. */
export function formatBlock(block?: number | string | null): string {
  if (block === null || block === undefined) return '\u2014';
  const num = typeof block === 'string' ? Number(block) : block;
  if (isNaN(num)) return '\u2014';
  return `#${num.toLocaleString('en-US')}`;
}
