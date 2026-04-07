export interface LeaderboardEntry {
  address: string;
  score: number;
  timestamp: number;
}

export async function submitScore(address: string, score: number): Promise<boolean> {
  try {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, score }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch("/api/leaderboard");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
