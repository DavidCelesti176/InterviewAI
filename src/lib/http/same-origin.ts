function requestHostname(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const raw = (forwarded ?? request.headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
  return raw.replace(/:\d+$/, "").toLowerCase();
}

/**
 * Accepts the site that served the page. Local http is limited to loopback.
 * Production must be https and match the host Netlify (or the dev server) presents.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = requestHostname(request);
    if (!host || url.hostname.toLowerCase() !== host) return false;
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (loopback) return url.protocol === "http:" || url.protocol === "https:";
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
