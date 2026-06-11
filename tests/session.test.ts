import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "../src/session";

const TEST_SECRET = "test-secret-key-must-be-long-enough-32+chars";
const FUTURE_IAT = 9_999_999_900;
const FUTURE_EXP = 9_999_999_999;

function futurePayload(overrides: Partial<{ passed: boolean; confirmed: boolean; iat: number; exp: number }> = {}) {
  return { passed: true, confirmed: false, iat: FUTURE_IAT, exp: FUTURE_EXP, ...overrides };
}

describe("session", () => {
  it("signs and verifies a payload round-trip", async () => {
    const payload = futurePayload();
    const cookie = await signSession(payload, TEST_SECRET);
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const verified = await verifySession(cookie, TEST_SECRET);
    expect(verified).toEqual(payload);
  });

  it("returns null when signature is tampered", async () => {
    const payload = futurePayload();
    const cookie = await signSession(payload, TEST_SECRET);
    const [data, sig] = cookie.split(".");
    const tamperedSig = sig.startsWith("A") ? "B" + sig.slice(1) : "A" + sig.slice(1);
    const tampered = `${data}.${tamperedSig}`;
    const verified = await verifySession(tampered, TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when payload is tampered", async () => {
    const payload = futurePayload();
    const cookie = await signSession(payload, TEST_SECRET);
    const [data, sig] = cookie.split(".");
    const tamperedData = data.startsWith("A") ? "B" + data.slice(1) : "A" + data.slice(1);
    const tampered = `${tamperedData}.${sig}`;
    const verified = await verifySession(tampered, TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when secret is wrong", async () => {
    const payload = futurePayload();
    const cookie = await signSession(payload, TEST_SECRET);
    const verified = await verifySession(cookie, "different-secret-also-long-enough-for-hmac");
    expect(verified).toBeNull();
  });

  it("returns null when cookie is expired", async () => {
    const payload = futurePayload({ iat: 1_700_000_000, exp: 1_700_000_600 });
    const cookie = await signSession(payload, TEST_SECRET);
    const verified = await verifySession(cookie, TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when cookie is malformed (no dot)", async () => {
    const verified = await verifySession("not-a-cookie", TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when cookie has empty payload", async () => {
    const verified = await verifySession(".signature", TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when cookie has empty signature", async () => {
    const verified = await verifySession("payload.", TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when cookie has more than one dot", async () => {
    const verified = await verifySession("a.b.c", TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when payload JSON is invalid", async () => {
    const verified = await verifySession("not-base64!!.signature", TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("returns null when payload is missing required fields", async () => {
    const bad = { foo: "bar" };
    const cookie = await signSession(bad as unknown as Parameters<typeof signSession>[0], TEST_SECRET);
    const verified = await verifySession(cookie, TEST_SECRET);
    expect(verified).toBeNull();
  });

  it("different secrets produce different signatures for the same payload", async () => {
    const payload = futurePayload();
    const a = await signSession(payload, "secret-A-32-chars-long-aaaaaaaaaa");
    const b = await signSession(payload, "secret-B-32-chars-long-bbbbbbbbbb");
    expect(a).not.toBe(b);
  });
});