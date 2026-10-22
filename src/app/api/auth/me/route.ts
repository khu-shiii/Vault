import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const u = await requireAuth(req);
  return ok({ user: { id: u.userId, email: u.email, role: u.role, organizationId: u.organizationId } });
});
