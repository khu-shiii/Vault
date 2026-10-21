import { PrismaClient } from "@prisma/client";

// One Prisma instance, reused across Next.js hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function testDbConnection(): Promise<{ connected: boolean }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch {
    return { connected: false };
  }
}

export default db;