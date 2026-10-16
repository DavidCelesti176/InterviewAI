function sameSiteGetWithoutOrigin(request: Request, host: string): boolean {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    const url = new URL(referer);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.hostname.toLowerCase() !== host) return false;
    return loopback ? url.protocol === "http:" || url.protocol === "https:" : url.protocol === "https:";
  } catch {
    return false;
  }
}

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
  const host = requestHostname(request);
  if (!host) return false;
  if (!origin) return sameSiteGetWithoutOrigin(request, host);
  try {
    const url = new URL(origin);
    if (url.hostname.toLowerCase() !== host) return false;
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (loopback) return url.protocol === "http:" || url.protocol === "https:";
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
