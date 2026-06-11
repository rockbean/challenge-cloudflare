export interface TurnstileSiteverifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
  messages?: string[];
}

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; errorCodes: string[]; messages: string[] };

export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  if (remoteIp) params.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    console.error("[turnstile] siteverify network error:", err);
    return { ok: false, errorCodes: ["network-error"], messages: [] };
  }

  if (!res.ok) {
    console.error("[turnstile] siteverify HTTP", res.status);
    return { ok: false, errorCodes: [`http-${res.status}`], messages: [] };
  }

  let body: TurnstileSiteverifyResponse;
  try {
    body = (await res.json()) as TurnstileSiteverifyResponse;
  } catch (err) {
    console.error("[turnstile] siteverify JSON parse error:", err);
    return { ok: false, errorCodes: ["invalid-response"], messages: [] };
  }

  if (body.success === true) return { ok: true };

  console.error(
    "[turnstile] siteverify rejected:",
    JSON.stringify({
      errorCodes: body["error-codes"] ?? [],
      messages: body.messages ?? [],
    })
  );
  return {
    ok: false,
    errorCodes: body["error-codes"] ?? [],
    messages: body.messages ?? [],
  };
}