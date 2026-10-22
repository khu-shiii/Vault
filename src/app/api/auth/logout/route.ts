import { handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto/merkle";
import { REFRESH_COOKIE, clearAuthCookies, readCookie } from "@/lib/auth/session";

export const POST = handle(async (req) => {
  const token = readCookie(req, REFRESH_COOKIE);
  if (token) {
    await db.refreshToken.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  const res = ok({ loggedOut: true });
  clearAuthCookies(res);
  return res;
});
