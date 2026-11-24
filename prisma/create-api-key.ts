import { randomBytes, createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

(async () => {
  const org = await db.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const key = `vk_${randomBytes(24).toString("hex")}`;
  await db.apiKey.create({
    data: { organizationId: org.id, label: "demo", prefix: key.slice(0, 10), keyHash: createHash("sha256").update(key).digest("hex") },
  });
  console.log(`API key for "${org.name}" (shown once): ${key}`);
})().finally(() => db.$disconnect());