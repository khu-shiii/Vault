import type { NextResponse } from "next/server";
import { ApiError } from "../api";
import { db } from "../db";
import { sha256 } from "../crypto/merkle";
import type { JwtPayload, Role } from "../types";
import { accessTtlMs, refreshTtlMs, signAccessToken, signRefreshToken, verifyAccessToken } from "./tokens";

export const ACCESS_COOKIE = "vault_access";
export const REFRESH_COOKIE = "vault_refresh";

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

const base = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production" };

export function setAuthCookies(res: NextResponse, access: string, refresh: string) {
  res.cookies.set(ACCESS_COOKIE, access, { ...base, path: "/", maxAge: accessTtlMs() / 1000 });
  // Refresh cookie is only ever sent to /api/auth/*
  res.cookies.set(REFRESH_COOKIE, refresh, { ...base, path: "/api/auth", maxAge: refreshTtlMs() / 1000 });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...base, path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base, path: "/api/auth", maxAge: 0 });
}

/** Issues a token pair and stores the refresh token hash (never the token itself). */
export async function startSession(user: { id: string; email: string; role: Role; organizationId: string }) {
  const claims = { userId: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
  const [access, refresh] = await Promise.all([signAccessToken(claims), signRefreshToken(claims)]);
  await db.refreshToken.create({
    data: { userId: user.id, tokenHash: sha256(refresh), expiresAt: new Date(Date.now() + refreshTtlMs()) },
  });
  return { access, refresh };
}

/** Route guard. Throws 401 if not logged in, 403 if the role isn't allowed. */
export async function requireAuth(req: Request, roles?: Role[]): Promise<JwtPayload> {
  const token = readCookie(req, ACCESS_COOKIE);
  const user = token ? await verifyAccessToken(token) : null;
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  if (roles && !roles.includes(user.role)) throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");
  return user;
}
