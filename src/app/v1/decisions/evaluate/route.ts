import { handle, readJson } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { createDecision } from "@/lib/intelligence/service";

export const POST = handle(async (req) => {
  const { organizationId } = await requireOrg(req, true);
  const { reused, decision } = await createDecision(organizationId, await readJson(req));
  return raw({ reused, ...decision }, reused ? 200 : 201);
});