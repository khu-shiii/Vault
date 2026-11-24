import { ApiError } from "./api";
import { ASSIGNABLE_ROLES } from "./auth/permissions";
import type { Role } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(v: unknown): string {
  const email = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) throw new ApiError(400, "BAD_REQUEST", "A valid email is required");
  return email;
}

export function parsePassword(v: unknown): string {
  if (typeof v !== "string" || v.length < 10 || v.length > 128) {
    throw new ApiError(400, "BAD_REQUEST", "Password must be 10 to 128 characters");
  }
  return v;
}

export function parseRole(v: unknown): Role {
  if (typeof v !== "string" || !ASSIGNABLE_ROLES.includes(v as Role)) {
    throw new ApiError(400, "BAD_REQUEST", `Role must be one of ${ASSIGNABLE_ROLES.join(", ")}`);
  }
  return v as Role;
}