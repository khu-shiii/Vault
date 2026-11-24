import { ApiError, clientIp, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setAuthCookies, startSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { parseEmail, parsePassword } from "@/lib/validation";

// Role given to everyone who signs up after the admin exists. Change to "SIGNER" if you prefer.
const SELF_SIGNUP_ROLE = "SIGNER" as const;

export const POST = handle(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 5, 60_000);

  const body = await readJson(req);
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  const passwordHash = await hashPassword(password);

  const rawOrg =
    body.organisationName ?? body.organizationName ?? body.orgName ?? body.organisation ??
    body.organization ?? body.org ?? body.company ?? body.name;
  const orgName = typeof rawOrg === "string" ? rawOrg.trim() : "";

  const user = await db.$transaction(async (tx) => {
    // Serialise registrations so two people can't both become the first admin.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(827361)`;

    if (await tx.user.findUnique({ where: { email } })) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }

    const admin = await tx.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });

    if (admin) {
      // Admin already exists: join their organisation with a non-admin role.
      return tx.user.create({
        data: { email, passwordHash, role: SELF_SIGNUP_ROLE, organizationId: admin.organizationId },
      });
    }

    // No admin yet: this person creates the organisation and becomes the one admin.
    if (orgName.length < 2 || orgName.length > 100) {
      throw new ApiError(400, "BAD_REQUEST", "Organisation name must be 2 to 100 characters");
    }
    return tx.user.create({
      data: { email, passwordHash, role: "ADMIN", organization: { create: { name: orgName } } },
    });
  });

  const { access, refresh } = await startSession(user);
  const res = ok(
    { user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId } },
    201
  );
  setAuthCookies(res, access, refresh);
  return res;
});