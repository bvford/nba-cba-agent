export type AnalyticsProps = Record<string, string | number | boolean | null>;

export function trackEvent(name: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    name,
    props,
    path: window.location.pathname,
    ts: new Date().toISOString(),
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/events", blob);
      return;
    }
  } catch {
    // Fall through to fetch if sendBeacon fails.
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Swallow analytics failures so UX is never blocked.
  });
}
