export interface SessionPayload {
  passed: boolean;
  confirmed: boolean;
  iat: number;
  exp: number;
}

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return new Uint8Array(new ArrayBuffer(0));
  }
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.passed === "boolean" &&
    typeof v.confirmed === "boolean" &&
    typeof v.iat === "number" &&
    typeof v.exp === "number"
  );
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const data = base64urlEncode(ENC.encode(JSON.stringify(payload)));
  const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, ENC.encode(data)));
  return `${data}.${base64urlEncode(sigBytes)}`;
}

export async function verifySession(cookie: string, secret: string): Promise<SessionPayload | null> {
  if (typeof cookie !== "string" || cookie.length === 0) return null;
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = base64urlDecode(sig);
  } catch {
    return null;
  }
  if (sigBytes.byteLength === 0) return null;

  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, ENC.encode(data));
  if (!ok) return null;

  let parsed: unknown;
  try {
    const json = DEC.decode(base64urlDecode(data));
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isSessionPayload(parsed)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp <= now) return null;

  return parsed;
}

export const SESSION_COOKIE_NAME = "cf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60;

export function buildSessionCookie(value: string, isSecure: boolean): string {
  const flags = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (isSecure) flags.push("Secure");
  return flags.join("; ");
}