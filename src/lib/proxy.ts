import { BASE_RPC_URL, USDC_ADDRESS, USDC_DECIMALS, ERC20_ABI } from './base';
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from 'viem';
import { base } from './base';

/**
 * Typed client for api.nullsec.studio/proxy.
 * Covers Privy server ops, Twilio send, Base RPC reads/writes, and phone resolution.
 * All secret-bearing operations are proxied; never expose keys in the frontend.
 */

const PROXY_URL = 'https://api.nullsec.studio/proxy';
const FETCH_URL = 'https://api.nullsec.studio/fetch-url';

function getAppId(): string {
  if (typeof window !== 'undefined') {
    const ns = (window as any).__NULLSEC__;
    if (ns?.projectId) return ns.projectId as string;
  }
  return 'nullsec-app';
}

export interface ProxyRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ProxyError {
  ok: false;
  error: string;
  status?: number;
}

export interface ProxyOk<T> {
  ok: true;
  data: T;
}

export type ProxyResult<T> = ProxyOk<T> | ProxyError;

/** Low-level proxied fetch. Returns a discriminated result, never throws. */
export async function proxyFetch<T = unknown>(req: ProxyRequest): Promise<ProxyResult<T>> {
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: getAppId(),
        url: req.url,
        method: req.method ?? 'GET',
        body: req.body,
        headers: req.headers,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Proxy returned ${res.status}`, status: res.status };
    }
    const json = (await res.json()) as T;
    return { ok: true, data: json };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

/** Fetch a public URL (CORS-safe) through the platform fetch-url endpoint. */
export async function fetchPublicUrl(url: string): Promise<ProxyResult<string>> {
  try {
    const res = await fetch(FETCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: getAppId(), url }),
    });
    if (!res.ok) return { ok: false, error: `fetch-url ${res.status}`, status: res.status };
    const text = await res.text();
    return { ok: true, data: text };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// ---------------------------------------------------------------------------
// Base RPC reads (direct, public client) — balances & contract reads
// These use the public Base RPC and are safe to call client-side.
// ---------------------------------------------------------------------------

let _client: ReturnType<typeof createPublicClient> | null = null;
function client() {
  if (!_client) {
    _client = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });
  }
  return _client;
}

/** Read native ETH balance (wei) for an address on Base. */
export async function rpcGetEthBalance(address: string): Promise<bigint | null> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  try {
    const bal = await client().getBalance({ address: address as `0x${string}` });
    return bal;
  } catch {
    // Fallback to raw RPC via proxy if direct call fails
    try {
      const r = await proxyFetch<{ result?: string }>({
        url: BASE_RPC_URL,
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        },
      });
      if (r.ok && r.data?.result) return BigInt(r.data.result);
    } catch {
      /* noop */
    }
    return null;
  }
}

/** Read USDC balance (base units, 6 decimals) for an address on Base. */
export async function rpcGetUsdcBalance(address: string): Promise<bigint | null> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  try {
    const bal = (await client().readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })) as bigint;
    return bal;
  } catch {
    // Fallback: eth_call via proxy
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });
      const r = await proxyFetch<{ result?: string }>({
        url: BASE_RPC_URL,
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: USDC_ADDRESS, data }, 'latest'],
        },
      });
      if (r.ok && r.data?.result && r.data.result !== '0x') {
        const decoded = decodeFunctionResult({
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          data: r.data.result as `0x${string}`,
        }) as bigint;
        return decoded;
      }
    } catch {
      /* noop */
    }
    return null;
  }
}

/** Read a transaction receipt by hash (for confirmation polling). */
export interface RpcReceipt {
  status: 'success' | 'reverted';
  blockNumber: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}

export async function rpcGetReceipt(txHash: string): Promise<RpcReceipt | null> {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) return null;
  try {
    const r = await client().getTransactionReceipt({ hash: txHash as `0x${string}` });
    return {
      status: r.status,
      blockNumber: r.blockNumber,
      gasUsed: r.gasUsed,
      effectiveGasPrice: r.effectiveGasPrice ?? 0n,
    };
  } catch {
    return null;
  }
}

/** Current ETH/USD price for gas-fee display, via CoinGecko (public, no key). */
export async function getEthUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ethereum?: { usd?: number } };
    return json?.ethereum?.usd ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Privy server operations (proxied — keys server-side)
// ---------------------------------------------------------------------------

export interface PrivyUserRecord {
  privyUserId: string;
  phone?: string;
  walletAddress?: string;
}

/** Verify/sync a Privy user server-side (key kept on proxy). Best-effort. */
export async function privySyncUser(
  payload: PrivyUserRecord
): Promise<ProxyResult<{ verified: boolean }>> {
  return proxyFetch<{ verified: boolean }>({
    url: 'https://auth.privy.io/api/v1/users',
    method: 'POST',
    body: payload,
  });
}

// ---------------------------------------------------------------------------
// Twilio outbound (proxied — credentials server-side)
// ---------------------------------------------------------------------------

export interface TwilioSendInput {
  to: string;
  channel: 'sms' | 'whatsapp';
  body: string;
}

/** Send an outbound SMS/WhatsApp confirmation. Best-effort, never throws. */
export async function twilioSend(
  input: TwilioSendInput
): Promise<ProxyResult<{ sid?: string }>> {
  const to = input.channel === 'whatsapp' ? `whatsapp:${input.to}` : input.to;
  return proxyFetch<{ sid?: string }>({
    url: 'https://api.twilio.com/2010-04-01/Messages.json',
    method: 'POST',
    body: { To: to, Body: input.body },
  });
}
