import type { PagesFunction } from "@cloudflare/workers-types";

export interface Env {
  TURNSTILE_SITE_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return new Response(JSON.stringify({ siteKey: env.TURNSTILE_SITE_KEY }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
