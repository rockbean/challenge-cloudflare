import type { PagesFunction } from "@cloudflare/workers-types";
import { buildSessionCookie, signSession, type SessionPayload } from "../../src/session";
import { verifyTurnstile } from "../../src/turnstile";
import { isSecureRequest, jsonResponse } from "../../src/http";

export interface Env {
  SESSION_SECRET: string;
  TURNSTILE_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return jsonResponse({ ok: false, error: "missing_token" }, 400);

  const remoteIp = request.headers.get("cf-connecting-ip") ?? undefined;
  const result = await verifyTurnstile(token, env.TURNSTILE_SECRET, remoteIp);
  if (!result.ok) {
    return jsonResponse(
      { ok: false, error: "turnstile_failed", codes: result.errorCodes },
      400
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    passed: true,
    confirmed: false,
    iat: now,
    exp: now + 60 * 60,
  };
  const cookieValue = await signSession(payload, env.SESSION_SECRET);
  const setCookie = buildSessionCookie(cookieValue, isSecureRequest(request.url));
  return jsonResponse({ ok: true, state: "passed" }, 200, { "Set-Cookie": setCookie });
};
