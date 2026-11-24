import { handle } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { getDecisionView } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const { organizationId } = await requireOrg(req, false);
  return raw(await getDecisionView(organizationId, params.id));
});