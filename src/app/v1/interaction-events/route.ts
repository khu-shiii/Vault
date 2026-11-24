import { handle, readJson } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { recordInteraction } from "@/lib/intelligence/service";

export const POST = handle(async (req) => {
  const { organizationId } = await requireOrg(req, true);
  return raw(await recordInteraction(organizationId, await readJson(req)), 202);
});