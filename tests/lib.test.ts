import { afterEach, describe, expect, it, vi } from "vitest";
import { can, ASSIGNABLE_ROLES } from "../src/lib/auth/permissions";
import { formatFileSize } from "../src/lib/format";
import { parseEmail, parsePassword, parseRole } from "../src/lib/validation";
import { api } from "../src/lib/client";

afterEach(() => vi.unstubAllGlobals());

describe("permissions", () => {
  it("matches the permission matrix", () => {
    expect(can("ADMIN", "user:manage")).toBe(true);
    expect(can("ADMIN", "document:upload")).toBe(true);
    expect(can("SIGNER", "document:upload")).toBe(true);
    expect(can("SIGNER", "user:manage")).toBe(false);
    expect(can("VIEWER", "document:read")).toBe(true);
    expect(can("VIEWER", "document:upload")).toBe(false);
    expect(can("PUBLIC_VERIFIER", "document:read")).toBe(false);
  });

  it("never lets PUBLIC_VERIFIER be assigned", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("PUBLIC_VERIFIER");
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});

describe("validation", () => {
  it("normalizes and rejects emails", () => {
    expect(parseEmail("  A@B.com ")).toBe("a@b.com");
    expect(() => parseEmail("nope")).toThrow();
  });
  it("enforces password length", () => {
    expect(() => parsePassword("short")).toThrow();
    expect(parsePassword("long-enough-1")).toBe("long-enough-1");
  });
  it("rejects unassignable roles", () => {
    expect(() => parseRole("PUBLIC_VERIFIER")).toThrow();
    expect(parseRole("SIGNER")).toBe("SIGNER");
  });
});

describe("api() refresh handling", () => {
  it("shares ONE refresh request between concurrent 401s", async () => {
    let refreshed = false;
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/auth/refresh") {
          refreshCalls++;
          await new Promise((r) => setTimeout(r, 20));
          refreshed = true;
          return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
        }
        return refreshed
          ? new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })
          : new Response("{}", { status: 401 });
      })
    );
    const [a, b] = await Promise.all([api("/api/a"), api("/api/b")]);
    expect(refreshCalls).toBe(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
  });
});