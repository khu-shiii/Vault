import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import type { JwtPayload } from "../types";

type Claims = Omit<JwtPayload, "type">;

const accessTtl = () => process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const refreshTtl = () => process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const value = process.env[name];
  if (!value || value.length < 16) throw new Error(`${name} must be set (min 16 chars)`);
  return new TextEncoder().encode(value);
}

/** "15m" | "7d" | "30s" | "2h" -> milliseconds */
export function ttlMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`Invalid TTL "${ttl}" (use e.g. 15m, 7d)`);
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] as "s" | "m" | "h" | "d"];
}
export const accessTtlMs = () => ttlMs(accessTtl());
export const refreshTtlMs = () => ttlMs(refreshTtl());

export const signAccessToken = (c: Claims) =>
  new SignJWT({ ...c, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(accessTtl())
    .sign(secret("JWT_ACCESS_SECRET"));

export const signRefreshToken = (c: Claims) =>
  new SignJWT({ ...c, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(refreshTtl())
    .sign(secret("JWT_REFRESH_SECRET"));

async function verifyToken(
  token: string,
  name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET",
  type: "access" | "refresh"
): Promise<JwtPayload | null> {
  const key = secret(name); // misconfiguration should throw, not look like a bad token
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload.type === type ? (payload as unknown as JwtPayload) : null;
  } catch {
    return null;
  }
}

export const verifyAccessToken = (t: string) => verifyToken(t, "JWT_ACCESS_SECRET", "access");
export const verifyRefreshToken = (t: string) => verifyToken(t, "JWT_REFRESH_SECRET", "refresh");
