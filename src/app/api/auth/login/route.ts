import { ApiError, clientIp, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setAuthCookies, startSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw new ApiError(400, "BAD_REQUEST", "Email and password are required");

  rateLimit(`login:${clientIp(req)}:${email}`, 10, 60_000);

  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(user?.passwordHash ?? null, password);
  if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const { access, refresh } = await startSession(user);
  const res = ok({ user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId } });
  setAuthCookies(res, access, refresh);
  return res;
});
