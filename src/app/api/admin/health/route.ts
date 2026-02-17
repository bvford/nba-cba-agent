import { NextResponse } from "next/server";
import { upstashEnabled } from "@/lib/upstash";

async function pingUpstash(): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["PING"]),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json?.result === "PONG";
  } catch {
    return false;
  }
}

export async function GET() {
  const upstashConfigured = upstashEnabled();
  const upstashReachable = upstashConfigured ? await pingUpstash() : false;

  return NextResponse.json(
    {
      ok: true,
      service: "chatcba",
      timestamp: new Date().toISOString(),
      limits: {
        per_day: 20,
        strategy: upstashConfigured ? "upstash+inmemory-fallback" : "inmemory-fallback-only",
      },
      cache: {
        ttl_seconds: 21600,
        strategy: upstashConfigured ? "upstash+inmemory-fallback" : "inmemory-fallback-only",
      },
      upstash: {
        configured: upstashConfigured,
        reachable: upstashReachable,
      },
    },
    { status: 200 }
  );
}
