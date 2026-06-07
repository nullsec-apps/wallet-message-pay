import { useState, useEffect, useCallback, useRef } from 'react';
import { rpcGetEthBalance, rpcGetUsdcBalance, getEthUsdPrice } from '../lib/proxy';
import { fromUsdcUnits, fromWei } from '../lib/base';

/**
 * Reads native ETH (gas) and USDC balance on Base via the public RPC, with
 * polling and a manual refresh used after confirmed transactions. Every value
 * is a real on-chain read — never mocked.
 */

export interface WalletBalance {
  ethWei: bigint | null;
  eth: string; // human-readable ETH
  ethUsd: number | null; // ETH value in USD
  usdcUnits: bigint | null;
  usdc: string; // human-readable USDC
  ethUsdPrice: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  hasGas: boolean;
  isEmpty: boolean;
}

export interface UseWalletBalance extends WalletBalance {
  refresh: () => Promise<void>;
}

const POLL_MS = 20000;

export function useWalletBalance(
  address: string | null,
  opts: { poll?: boolean } = { poll: true }
): UseWalletBalance {
  const [state, setState] = useState<WalletBalance>({
    ethWei: null,
    eth: '0',
    ethUsd: null,
    usdcUnits: null,
    usdc: '0',
    ethUsdPrice: null,
    loading: false,
    error: null,
    lastUpdated: null,
    hasGas: false,
    isEmpty: true,
  });
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      if (mounted.current) {
        setState((s) => ({
          ...s,
          loading: false,
          error: null,
          isEmpty: true,
        }));
      }
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const [ethWei, usdcUnits, ethPrice] = await Promise.all([
        rpcGetEthBalance(address),
        rpcGetUsdcBalance(address),
        getEthUsdPrice(),
      ]);

      const ethStr = ethWei !== null ? fromWei(ethWei) : '0';
      const usdcStr = usdcUnits !== null ? fromUsdcUnits(usdcUnits) : '0';
      const ethNum = Number(ethStr);
      const usdcNum = Number(usdcStr);
      const ethUsd =
        ethWei !== null && ethPrice !== null ? ethNum * ethPrice : null;

      if (mounted.current) {
        setState({
          ethWei,
          eth: ethStr,
          ethUsd,
          usdcUnits,
          usdc: usdcStr,
          ethUsdPrice: ethPrice,
          loading: false,
          error: ethWei === null && usdcUnits === null ? 'Could not read balances' : null,
          lastUpdated: Date.now(),
          hasGas: ethWei !== null && ethWei > 0n,
          isEmpty: usdcNum <= 0 && ethNum <= 0,
        });
      }
    } catch (e: any) {
      if (mounted.current) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message || 'Balance read failed',
        }));
      }
    } finally {
      inFlight.current = false;
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!opts.poll || !address) return;
    const id = window.setInterval(() => {
      refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [opts.poll, address, refresh]);

  return { ...state, refresh };
}
