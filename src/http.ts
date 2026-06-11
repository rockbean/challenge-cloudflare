const JSON_HEADERS: HeadersInit = { "content-type": "application/json; charset=utf-8" };

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const piece of header.split(";")) {
    const eq = piece.indexOf("=");
    if (eq < 0) continue;
    const name = piece.slice(0, eq).trim();
    const value = piece.slice(eq + 1).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(value);
  }
  return out;
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function isSecureRequest(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
