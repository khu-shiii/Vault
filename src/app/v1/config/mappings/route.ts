import { handle, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { getMappings, setMappings } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const { organizationId } = await requireOrg(req, false);
  return raw(await getMappings(organizationId));
});

/** Admin session only: changes how events map to intents for the whole organization. */
export const PUT = handle(async (req) => {
  const admin = await requirePermission(req, "user:manage");
  return raw(await setMappings(admin.organizationId, await readJson(req)));
});