import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const LEADERBOARD_KEY = "temple:leaderboard";
const MAX_ENTRIES = 50;

export async function GET() {
  try {
    const raw = await redis.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, {
      rev: true,
      withScores: true,
    });

    const entries: { address: string; score: number; timestamp: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const address = raw[i] as string;
      const score = raw[i + 1] as number;
      entries.push({ address, score, timestamp: 0 });
    }

    return NextResponse.json(entries);
  } catch (err) {
    console.error("Leaderboard GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, score } = body as { address: string; score: number };

    if (!address || typeof score !== "number" || score < 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const current = await redis.zscore(LEADERBOARD_KEY, address);
    if (current === null || score > Number(current)) {
      await redis.zadd(LEADERBOARD_KEY, { score, member: address });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Leaderboard POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
