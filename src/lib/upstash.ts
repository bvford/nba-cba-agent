export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function isConfigured(): boolean {
  return Boolean(REST_URL && REST_TOKEN);
}

async function command(args: Array<string | number>): Promise<unknown> {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error("Upstash is not configured");
  }

  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash command failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json?.error) {
    throw new Error(`Upstash error: ${json.error}`);
  }
  return json?.result;
}

export async function incrementDailyLimit(
  key: string,
  limit: number
): Promise<RateLimitResult | null> {
  if (!isConfigured()) return null;

  const count = Number(await command(["INCR", key]));
  if (count === 1) {
    // Keep key for ~2 days so prior day keys expire naturally.
    await command(["EXPIRE", key, 172800]);
  }

  return {
    allowed: count <= limit,
    count,
  };
}

export async function getCachedResponse<T>(key: string): Promise<T | null> {
  if (!isConfigured()) return null;
  const value = await command(["GET", key]);
  if (!value || typeof value !== "string") return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setCachedResponse<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!isConfigured()) return;
  await command(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
}

export function upstashEnabled(): boolean {
  return isConfigured();
}
