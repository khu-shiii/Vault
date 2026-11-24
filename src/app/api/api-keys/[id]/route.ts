import { ApiError, handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export const DELETE = handle(async (req, { params }) => {
  const admin = await requirePermission(req, "user:manage");
  const { count } = await db.apiKey.updateMany({
    where: { id: params.id, organizationId: admin.organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new ApiError(404, "NOT_FOUND", "Active key not found");
  return ok({ revoked: true });
});