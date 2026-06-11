import type { PagesFunction } from "@cloudflare/workers-types";
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from "../../src/session";
import { jsonResponse, parseCookies } from "../../src/http";

export interface Env {
  SESSION_SECRET: string;
}

function deriveState(payload: SessionPayload | null): "challenge" | "passed" | "confirmed" {
  if (!payload) return "challenge";
  if (payload.confirmed) return "confirmed";
  if (payload.passed) return "passed";
  return "challenge";
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const raw = cookies[SESSION_COOKIE_NAME];
  const payload = raw ? await verifySession(raw, env.SESSION_SECRET) : null;
  return jsonResponse({ state: deriveState(payload) });
};
