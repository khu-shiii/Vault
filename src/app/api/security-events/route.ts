import { handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const admin = await requirePermission(req, "user:manage");
  const rows = await db.securityEvent.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { email: true } }, target: { select: { email: true } } },
  });
  return ok({
    events: rows.map((e) => ({
      id: e.id, action: e.action, details: e.details, createdAt: e.createdAt,
      actorEmail: e.actor?.email ?? null, targetEmail: e.target?.email ?? null,
    })),
  });
});