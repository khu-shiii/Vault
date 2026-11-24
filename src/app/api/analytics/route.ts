import { handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Raw points for the last 30 days. The client groups them by day with useMemo. */
export const GET = handle(async (req) => {
  const user = await requirePermission(req, "document:read");
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [attempts, events, decisions] = await Promise.all([
    db.verificationAttempt.findMany({
      where: { verifiedAt: { gte: since }, document: { organizationId: user.organizationId } },
      select: { verifiedAt: true, isAuthentic: true },
      orderBy: { verifiedAt: "asc" },
      take: 5000,
    }),
    db.sdkEvent.findMany({
      where: { organizationId: user.organizationId, receivedAt: { gte: since } },
      select: { receivedAt: true },
      orderBy: { receivedAt: "asc" },
      take: 5000,
    }),
    db.decision.findMany({
      where: { organizationId: user.organizationId, createdAt: { gte: since } },
      select: { createdAt: true, excluded: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
  ]);

  return ok({
    verifications: attempts.map((a) => ({ at: a.verifiedAt.toISOString(), authentic: a.isAuthentic })),
    events: events.map((e) => ({ at: e.receivedAt.toISOString() })),
    exclusions: decisions.map((d) => ({
      at: d.createdAt.toISOString(),
      count: Array.isArray(d.excluded) ? d.excluded.length : 0,
    })),
  });
});