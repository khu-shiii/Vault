import { handle } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { inspect } from "@/lib/intelligence/inspect";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const { organizationId } = await requireOrg(req, false);
  return raw(await inspect(organizationId, new URL(req.url).searchParams.get("q") ?? ""));
});