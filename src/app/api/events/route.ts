import { NextRequest } from "next/server";
import { z } from "zod";
import {
  MAX_EVENT_BODY_BYTES,
  MAX_EVENT_NAME_CHARS,
  MAX_EVENT_PATH_CHARS,
  MAX_EVENT_PROPS_BYTES,
} from "@/lib/config";

const EventSchema = z.object({
  name: z.string().max(MAX_EVENT_NAME_CHARS),
  props: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (value) => !value || Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_EVENT_PROPS_BYTES,
      { message: "props payload too large" }
    ),
  path: z.string().max(MAX_EVENT_PATH_CHARS).optional(),
  // Accept both: legacy/stale clients may still send an ISO string; current
  // clients send Date.now(). Union keeps either from being silently dropped.
  ts: z.union([z.number(), z.string()]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // Silently drop oversized payloads — no logging, this is just analytics.
    if (Buffer.byteLength(bodyText, "utf8") > MAX_EVENT_BODY_BYTES) {
      return new Response(null, { status: 204 });
    }

    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      return new Response(null, { status: 204 });
    }

    const result = EventSchema.safeParse(json);
    if (!result.success) {
      return new Response(null, { status: 204 });
    }

    const { name, props = {}, path = "/", ts } = result.data;
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    console.log(
      `[analytics] ${JSON.stringify({
        name,
        props,
        path,
        ts: ts ?? new Date().toISOString(),
        ip,
        userAgent,
      })}`
    );

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
