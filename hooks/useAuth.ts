"use client";

import { useEffect, useState, useCallback } from "react";

interface AuthState {
  ready: boolean;
  authenticated: boolean;
  address: string | undefined;
  login: () => void;
  logout: () => void;
}

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getEthereum(): EthProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthProvider }).ethereum;
}

export function useAuth(): AuthState {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | undefined>();

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) {
      setReady(true);
      return;
    }

    eth.request({ method: "eth_accounts" }).then((accounts) => {
      const accs = accounts as string[];
      if (accs.length > 0) {
        setAddress(accs[0]);
      }
      setReady(true);
    }).catch(() => setReady(true));

    eth.on?.("accountsChanged", (accounts) => {
      const accs = accounts as string[];
      setAddress(accs.length > 0 ? accs[0] : undefined);
    });
  }, []);

  const login = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const accs = accounts as string[];
      if (accs.length > 0) {
        setAddress(accs[0]);
      }
    } catch {
      // user rejected
    }
  }, []);

  const logout = useCallback(() => {
    setAddress(undefined);
  }, []);

  return {
    ready,
    authenticated: !!address,
    address,
    login,
    logout,
  };
}
