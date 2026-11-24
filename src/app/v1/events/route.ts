import { handle } from "@/lib/api";
import { db } from "@/lib/db";
import { raw, requireOrg } from "@/lib/intelligence/guard";

export const dynamic = "force-dynamic";

/** Most recent accepted SDK events for the organization (powers the dashboard's live capture feed). */
export const GET = handle(async (req) => {
  const { organizationId } = await requireOrg(req, false);
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 30));
  const events = await db.sdkEvent.findMany({
    where: { organizationId }, orderBy: { receivedAt: "desc" }, take: limit,
    select: { eventId: true, eventName: true, externalCustomerId: true, anonymousId: true, source: true, occurredAt: true, receivedAt: true },
  });
  return raw({ events });
});