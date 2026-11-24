import { handle, readJson } from "@/lib/api";
import { raw, requireOrg } from "@/lib/intelligence/guard";
import { mockTransport, validateCanonical } from "@/lib/intelligence/transport";

export const POST = handle(async (req) => {
  await requireOrg(req, true);
  return raw(await mockTransport.send(validateCanonical(await readJson(req))), 202);
});