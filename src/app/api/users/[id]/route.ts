import { ApiError, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requirePermission } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/security-events";
import { parsePassword, parseRole } from "@/lib/validation";

/** PATCH { role?, password?, disabled? }: change role, reset password, disable/enable. */
export const PATCH = handle(async (req, { params }) => {
  const admin = await requirePermission(req, "user:manage");
  const body = await readJson(req);
  const newRole = body.role !== undefined ? parseRole(body.role) : undefined;
  const newPassword = body.password !== undefined ? parsePassword(body.password) : undefined;
  const disabled = body.disabled;
  if (disabled !== undefined && typeof disabled !== "boolean") throw new ApiError(400, "BAD_REQUEST", "disabled must be a boolean");
  if (newRole === undefined && newPassword === undefined && disabled === undefined) {
    throw new ApiError(400, "BAD_REQUEST", "Nothing to update");
  }
  if (params.id === admin.userId && (newRole !== undefined || disabled !== undefined)) {
    throw new ApiError(400, "BAD_REQUEST", "You cannot change your own role or disable yourself");
  }
  const passwordHash = newPassword !== undefined ? await hashPassword(newPassword) : undefined;

  const updated = await db.$transaction(async (tx) => {
    // Serialize admin changes per organization so two admins can't demote each other at once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${admin.organizationId}))`;

    // Re-check the actor under the lock: they may have been demoted while this request was in flight.
    const actor = await tx.user.findUnique({ where: { id: admin.userId }, select: { role: true, disabledAt: true } });
    if (!actor || actor.disabledAt || actor.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");

    const target = await tx.user.findFirst({ where: { id: params.id, organizationId: admin.organizationId } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "User not found");

    const removesAdmin =
      target.role === "ADMIN" && !target.disabledAt && ((newRole !== undefined && newRole !== "ADMIN") || disabled === true);
    if (removesAdmin) {
      const others = await tx.user.count({
        where: { organizationId: admin.organizationId, role: "ADMIN", disabledAt: null, id: { not: target.id } },
      });
      if (others === 0) throw new ApiError(409, "LAST_ADMIN", "The organization must keep at least one active admin");
    }

    const user = await tx.user.update({
      where: { id: target.id },
      data: {
        ...(newRole !== undefined && { role: newRole }),
        ...(passwordHash !== undefined && { passwordHash }),
        ...(disabled !== undefined && { disabledAt: disabled ? new Date() : null }),
      },
      select: { id: true, email: true, role: true, disabledAt: true, createdAt: true },
    });

    const ctx = { organizationId: admin.organizationId, actorId: admin.userId, targetUserId: target.id };
    if (newRole !== undefined && newRole !== target.role) {
      await logSecurityEvent({ ...ctx, action: "USER_ROLE_CHANGED", details: { from: target.role, to: newRole } }, tx);
    }
    if (passwordHash !== undefined) await logSecurityEvent({ ...ctx, action: "USER_PASSWORD_RESET" }, tx);
    if (disabled !== undefined && disabled !== !!target.disabledAt) {
      await logSecurityEvent({ ...ctx, action: disabled ? "USER_DISABLED" : "USER_ENABLED" }, tx);
    }
    // New password or disabled account: kill every session.
    if (passwordHash !== undefined || disabled === true) {
      await tx.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return user;
  });

  return ok({ user: updated });
});