"use client";

import { useCallback, useState } from "react";
import {
  createPublicClient,
  http,
  decodeEventLog,
  encodeFunctionData,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { Attribution } from "ox/erc8021";
import { useAuth } from "@/hooks/useAuth";
import { GAME_CONTRACT_ADDRESS, GAME_CONTRACT_ABI } from "@/lib/contract";

const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE || "REPLACE_WITH_YOUR_BUILDER_CODE";
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });

const PAYMASTER_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/paymaster`
    : "/api/paymaster";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getProvider(): EthereumProvider {
  const ethereum = typeof window !== "undefined"
    ? (window as unknown as { ethereum?: EthereumProvider }).ethereum
    : undefined;
  if (!ethereum) throw new Error("No wallet provider found");
  return ethereum;
}

async function sendWithPaymaster(
  provider: EthereumProvider,
  from: string,
  to: string,
  data: Hex
): Promise<string> {
  try {
    const result = await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "1",
          from,
          chainId: `0x${(8453).toString(16)}`,
          calls: [{ to, data }],
          capabilities: {
            paymasterService: {
              url: PAYMASTER_URL,
            },
            dataSuffix: {
              value: DATA_SUFFIX,
              optional: true,
            },
          },
        },
      ],
    });
    const callId = result as string;

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const status = (await provider.request({
          method: "wallet_getCallsStatus",
          params: [callId],
        })) as { status: string; receipts?: Array<{ transactionHash: string }> };

        if (status.status === "CONFIRMED" && status.receipts?.[0]) {
          return status.receipts[0].transactionHash;
        }
      } catch {
        /* keep polling */
      }
    }
    throw new Error("Transaction timed out");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("not supported") ||
      msg.includes("not found") ||
      msg.includes("does not support")
    ) {
      throw new Error("FALLBACK");
    }
    throw e;
  }
}

function appendSuffix(data: Hex): Hex {
  return (data + DATA_SUFFIX.slice(2)) as Hex;
}

async function sendRegular(
  provider: EthereumProvider,
  from: string,
  to: string,
  data: Hex
): Promise<string> {
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data: appendSuffix(data) }],
  });
  return hash as string;
}

export function useContract() {
  const { address: authAddress } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTx = useCallback(
    async (data: Hex): Promise<string> => {
      if (!authAddress) throw new Error("Please connect your wallet first");
      const provider = getProvider();

      try {
        return await sendWithPaymaster(
          provider,
          authAddress,
          GAME_CONTRACT_ADDRESS,
          data
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "FALLBACK") {
          return await sendRegular(
            provider,
            authAddress,
            GAME_CONTRACT_ADDRESS,
            data
          );
        }
        throw e;
      }
    },
    [authAddress]
  );

  const startRun = useCallback(
    async (): Promise<{ success: boolean; nftMinted: boolean; tokenId?: string }> => {
      setLoading(true);
      setError(null);
      try {
        const data = encodeFunctionData({
          abi: GAME_CONTRACT_ABI,
          functionName: "startRun",
          args: [],
        });

        const hash = await sendTx(data);
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: hash as `0x${string}`,
        });

        let nftMinted = false;
        let tokenId: string | undefined;
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: GAME_CONTRACT_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (event.eventName === "ExplorerNFTMinted") {
              nftMinted = true;
              tokenId = String(
                (event.args as unknown as { tokenId: bigint }).tokenId
              );
            }
          } catch {
            /* skip non-matching logs */
          }
        }

        return { success: true, nftMinted, tokenId };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Transaction failed";
        if (msg.includes("User rejected") || msg.includes("denied")) {
          setError(null);
        } else {
          setError(msg.length > 80 ? msg.slice(0, 80) + "..." : msg);
        }
        return { success: false, nftMinted: false };
      } finally {
        setLoading(false);
      }
    },
    [sendTx]
  );

  const submitRun = useCallback(
    async (score: number, distance: number, coins: number, bestCombo: number, powerUps: number): Promise<boolean> => {
      try {
        const data = encodeFunctionData({
          abi: GAME_CONTRACT_ABI,
          functionName: "submitRun",
          args: [score, distance, coins, bestCombo, powerUps],
        });
        const hash = await sendTx(data);
        await publicClient.waitForTransactionReceipt({
          hash: hash as `0x${string}`,
        });
        return true;
      } catch {
        return false;
      }
    },
    [sendTx]
  );

  const gm = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const data = encodeFunctionData({
        abi: GAME_CONTRACT_ABI,
        functionName: "gm",
        args: [],
      });

      const hash = await sendTx(data);
      await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      if (msg.includes("User rejected") || msg.includes("denied")) {
        setError(null);
      } else if (msg.includes("Already gm today")) {
        setError("Already checked in today!");
      } else {
        setError(msg.length > 80 ? msg.slice(0, 80) + "..." : msg);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [sendTx]);

  const canGm = useCallback(async (address: string): Promise<boolean> => {
    try {
      const result = await publicClient.readContract({
        address: GAME_CONTRACT_ADDRESS,
        abi: GAME_CONTRACT_ABI,
        functionName: "canGm",
        args: [address as `0x${string}`],
      });
      return result as boolean;
    } catch {
      return false;
    }
  }, []);

  const getPlayerStats = useCallback(async (address: string) => {
    try {
      const result = await publicClient.readContract({
        address: GAME_CONTRACT_ADDRESS,
        abi: GAME_CONTRACT_ABI,
        functionName: "getPlayerStats",
        args: [address as `0x${string}`],
      });
      const [runs, highScore, coins, longestDist, combo, streak, gms, hasNFT] =
        result as [number, number, number, number, number, number, number, boolean];
      return {
        runs: Number(runs),
        highScore: Number(highScore),
        coins: Number(coins),
        longestDist: Number(longestDist),
        combo: Number(combo),
        streak: Number(streak),
        gms: Number(gms),
        hasNFT,
      };
    } catch {
      return null;
    }
  }, []);

  return { startRun, submitRun, gm, canGm, getPlayerStats, loading, error };
}
