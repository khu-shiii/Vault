import { clientIp, handle, ok, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { parseHashes, verifyHashes } from "@/lib/verify";

/** Zero-upload verification: the browser sends only hashes. */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  rateLimit(`verify:${ip}`, 30, 60_000);
  return ok(await verifyHashes({ ...parseHashes(await readJson(req)), ip }));
});