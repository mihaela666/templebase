"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useCallback } from "react";

interface AuthState {
  ready: boolean;
  authenticated: boolean;
  address: string | undefined;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const { address, isConnected, status } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const login = useCallback(() => {
    connect({ connector: injected() });
  }, [connect]);

  const logout = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return {
    ready: status !== "connecting" && status !== "reconnecting",
    authenticated: isConnected,
    address,
    login,
    logout,
  };
}
