import { ApiError, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requirePermission } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/security-events";
import { parseEmail, parsePassword, parseRole } from "@/lib/validation";

export const dynamic = "force-dynamic";

const userSelect = { id: true, email: true, role: true, disabledAt: true, createdAt: true } as const;

export const GET = handle(async (req) => {
  const admin = await requirePermission(req, "user:manage");
  const users = await db.user.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { createdAt: "asc" },
    select: userSelect,
  });
  return ok({ users });
});

export const POST = handle(async (req) => {
  const admin = await requirePermission(req, "user:manage");
  const body = await readJson(req);
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  const role = parseRole(body.role ?? "VIEWER");

  const passwordHash = await hashPassword(password);
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { organizationId: admin.organizationId, email, passwordHash, role },
        select: userSelect,
      });
      await logSecurityEvent(
        { organizationId: admin.organizationId, actorId: admin.userId, targetUserId: created.id, action: "USER_CREATED", details: { email, role } },
        tx
      );
      return created;
    });
    return ok({ user }, 201);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "EMAIL_TAKEN", "A user with this email already exists");
    throw e;
  }
});