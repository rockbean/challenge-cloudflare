export interface TurnstileSiteverifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string
): Promise<boolean> {
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
  } catch {
    return false;
  }

  if (!res.ok) return false;

  let body: TurnstileSiteverifyResponse;
  try {
    body = (await res.json()) as TurnstileSiteverifyResponse;
  } catch {
    return false;
  }

  return body.success === true;
}