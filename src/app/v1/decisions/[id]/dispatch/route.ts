import { handle } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { dispatchDecision, parseNow } from "@/lib/intelligence/service";

export const POST = handle(async (req, { params }) => {
  const { organizationId } = await requireOrg(req, true);
  const body = await req.json().catch(() => ({}));
  const now = parseNow(body && typeof body === "object" ? (body as Record<string, unknown>) : {});
  return raw(await dispatchDecision(organizationId, params.id, now), 202);
});