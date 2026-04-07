import { NextResponse } from "next/server";

const CDP_PAYMASTER_URL = process.env.CDP_PAYMASTER_URL || "";

export async function POST(request: Request) {
  if (!CDP_PAYMASTER_URL) {
    return NextResponse.json(
      { error: "Paymaster not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const res = await fetch(CDP_PAYMASTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("Paymaster error:", err);
    return NextResponse.json({ error: "Paymaster error" }, { status: 500 });
  }
}
