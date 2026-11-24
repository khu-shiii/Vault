import { randomBytes } from "crypto";
import { handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto/merkle";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const admin = await requirePermission(req, "user:manage");
  const keys = await db.apiKey.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, prefix: true, createdAt: true, revokedAt: true },
  });
  return ok({ keys });
});

/** The raw key is returned once and only its hash is stored. */
export const POST = handle(async (req) => {
  const admin = await requirePermission(req, "user:manage");
  const body = await readJson(req);
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 64) : "default";
  const key = `vk_${randomBytes(24).toString("hex")}`;
  const row = await db.apiKey.create({
    data: { organizationId: admin.organizationId, label, prefix: key.slice(0, 10), keyHash: sha256(key) },
    select: { id: true, label: true, prefix: true, createdAt: true },
  });
  return ok({ ...row, key }, 201);
});