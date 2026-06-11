import { describe, it, expect } from "vitest";
import { parseCookies, jsonResponse, isSecureRequest } from "../src/http";

describe("http", () => {
  describe("parseCookies", () => {
    it("returns an empty object when the header is null or empty", () => {
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies("")).toEqual({});
    });

    it("parses a single cookie", () => {
      expect(parseCookies("cf_session=abc123")).toEqual({ cf_session: "abc123" });
    });

    it("parses multiple cookies separated by semicolons and trims whitespace", () => {
      const parsed = parseCookies("cf_session=abc123; theme=dark; lang=en-US");
      expect(parsed).toEqual({ cf_session: "abc123", theme: "dark", lang: "en-US" });
    });

    it("decodes URL-encoded cookie values", () => {
      const parsed = parseCookies("greeting=hello%20world");
      expect(parsed.greeting).toBe("hello world");
    });

    it("ignores malformed fragments without an equals sign", () => {
      const parsed = parseCookies("good=value; nosep; also=ok");
      expect(parsed).toEqual({ good: "value", also: "ok" });
    });
  });

  describe("jsonResponse", () => {
    it("returns a Response with application/json content-type by default", async () => {
      const res = jsonResponse({ hello: "world" });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(await res.json()).toEqual({ hello: "world" });
    });

    it("honors a custom status code", () => {
      const res = jsonResponse({ ok: false }, 401);
      expect(res.status).toBe(401);
    });

    it("merges extra headers on top of the default JSON header", () => {
      const res = jsonResponse({ ok: true }, 200, { "Set-Cookie": "x=1" });
      expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(res.headers.get("Set-Cookie")).toBe("x=1");
    });
  });

  describe("isSecureRequest", () => {
    it("returns true for https URLs", () => {
      expect(isSecureRequest("https://example.com/api")).toBe(true);
    });

    it("returns false for http URLs", () => {
      expect(isSecureRequest("http://example.com/api")).toBe(false);
    });

    it("returns false for non-URL strings", () => {
      expect(isSecureRequest("not a url")).toBe(false);
      expect(isSecureRequest("")).toBe(false);
    });
  });
});
