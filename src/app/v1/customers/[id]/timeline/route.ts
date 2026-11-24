import { handle } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { getTimeline } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const { organizationId } = await requireOrg(req, false);
  return raw(await getTimeline(organizationId, decodeURIComponent(params.id)));
});