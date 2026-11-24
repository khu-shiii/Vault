import { handle, readJson } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { identify } from "@/lib/intelligence/service";

export const POST = handle(async (req) => {
  const { organizationId } = await requireOrg(req, true);
  return raw(await identify(organizationId, await readJson(req)));
});