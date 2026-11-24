import { ApiError, handle, readJson } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { ingestEvents } from "@/lib/intelligence/service";

export const POST = handle(async (req) => {
  const { organizationId } = await requireOrg(req, true);
  const body = await readJson(req);
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 100) {
    throw new ApiError(400, "BAD_REQUEST", "events must be an array of 1 to 100 items");
  }
  return raw(await ingestEvents(organizationId, body.events), 202);
});