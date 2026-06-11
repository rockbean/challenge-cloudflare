import { describe, it, expect, vi } from "vitest";
import { verifyTurnstile } from "../src/turnstile";

describe("turnstile", () => {
  it("returns true when siteverify responds success=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const ok = await verifyTurnstile("dummy.token.value", "secret", "1.2.3.4");
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const body = init.body as string;
    expect(body).toContain("secret=secret");
    expect(body).toContain("response=dummy.token.value");
    expect(body).toContain("remoteip=1.2.3.4");

    vi.unstubAllGlobals();
  });

  it("returns false when siteverify responds success=false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const ok = await verifyTurnstile("bad.token", "secret");
    expect(ok).toBe(false);

    vi.unstubAllGlobals();
  });

  it("returns false on non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const ok = await verifyTurnstile("any", "secret");
    expect(ok).toBe(false);

    vi.unstubAllGlobals();
  });

  it("returns false when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const ok = await verifyTurnstile("any", "secret");
    expect(ok).toBe(false);

    vi.unstubAllGlobals();
  });

  it("omits remoteip when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await verifyTurnstile("tok", "sec");
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as string;
    expect(body).not.toContain("remoteip");

    vi.unstubAllGlobals();
  });
});