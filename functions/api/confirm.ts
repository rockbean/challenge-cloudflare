import type { PagesFunction } from "@cloudflare/workers-types";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  signSession,
  verifySession,
  type SessionPayload,
} from "../../src/session";
import { isSecureRequest, jsonResponse, parseCookies } from "../../src/http";

export interface Env {
  SESSION_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const raw = cookies[SESSION_COOKIE_NAME];
  const current = raw ? await verifySession(raw, env.SESSION_SECRET) : null;
  if (!current || !current.passed) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  const now = Math.floor(Date.now() / 1000);
  const next: SessionPayload = {
    passed: true,
    confirmed: true,
    iat: now,
    exp: now + 60 * 60,
  };
  const cookieValue = await signSession(next, env.SESSION_SECRET);
  const setCookie = buildSessionCookie(cookieValue, isSecureRequest(request.url));
  return jsonResponse({ ok: true, state: "confirmed" }, 200, { "Set-Cookie": setCookie });
};
