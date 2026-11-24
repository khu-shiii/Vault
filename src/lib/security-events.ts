import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type SecurityAction =
  | "USER_CREATED"
  | "USER_ROLE_CHANGED"
  | "USER_PASSWORD_RESET"
  | "USER_DISABLED"
  | "USER_ENABLED";

export async function logSecurityEvent(
  e: { organizationId: string; actorId: string; targetUserId: string; action: SecurityAction; details?: Record<string, unknown> },
  tx: Prisma.TransactionClient | typeof db = db
) {
  await tx.securityEvent.create({
    data: {
      organizationId: e.organizationId,
      actorId: e.actorId,
      targetUserId: e.targetUserId,
      action: e.action,
      details: (e.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}