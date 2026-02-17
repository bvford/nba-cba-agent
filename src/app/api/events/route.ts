import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    const name = typeof body?.name === "string" ? body.name : "unknown_event";
    const props = typeof body?.props === "object" && body?.props !== null ? body.props : {};
    const path = typeof body?.path === "string" ? body.path : "/";
    const ts = typeof body?.ts === "string" ? body.ts : new Date().toISOString();

    console.log(
      `[analytics] ${JSON.stringify({
        name,
        props,
        path,
        ts,
        ip,
        userAgent,
      })}`
    );

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
