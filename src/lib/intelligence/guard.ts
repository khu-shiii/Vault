import { NextResponse } from "next/server";
import { ApiError } from "../api";
import { db } from "../db";
import { sha256 } from "../crypto/merkle";
import { requirePermission } from "../auth/session";
import { rateLimit } from "../rate-limit";

/** /v1 responses are bare JSON, matching the PRD contract. */
export const raw = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Org scope from an API key (x-api-key or Bearer), or from a logged-in session. */
export async function requireOrg(req: Request, write: boolean): Promise<{ organizationId: string }> {
  const header = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  let organizationId: string;
  if (header) {
    const key = await db.apiKey.findUnique({ where: { keyHash: sha256(header) }, select: { organizationId: true, revokedAt: true } });
    if (!key || key.revokedAt) throw new ApiError(401, "INVALID_API_KEY", "Invalid or revoked API key");
    organizationId = key.organizationId;
  } else {
    organizationId = (await requirePermission(req, write ? "document:upload" : "document:read")).organizationId;
  }
  rateLimit(`v1:${organizationId}`, 600, 60_000);
  return { organizationId };
}