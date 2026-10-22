import { ApiError, handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto/merkle";
import { REFRESH_COOKIE, readCookie, setAuthCookies, startSession } from "@/lib/auth/session";
import { verifyRefreshToken } from "@/lib/auth/tokens";

const invalid = () => new ApiError(401, "INVALID_REFRESH", "Invalid or expired refresh token");

export const POST = handle(async (req) => {
  const token = readCookie(req, REFRESH_COOKIE);
  if (!token || !(await verifyRefreshToken(token))) throw invalid();

  const stored = await db.refreshToken.findFirst({ where: { tokenHash: sha256(token) } });
  if (!stored || stored.expiresAt < new Date()) throw invalid();

  if (stored.revokedAt) {
    // A rotated token was replayed: assume theft and kill every session for this user.
    await db.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw invalid();
  }

  // Atomic rotate: only one concurrent request can win.
  const { count } = await db.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const user = count === 1 ? await db.user.findUnique({ where: { id: stored.userId } }) : null;
  if (!user) throw invalid();

  const { access, refresh } = await startSession(user);
  const res = ok({ user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId } });
  setAuthCookies(res, access, refresh);
  return res;
});
