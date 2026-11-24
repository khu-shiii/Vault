import type { Role } from "../types";

export type Permission = "document:read" | "document:upload" | "user:manage";

const VIEWER: Permission[] = ["document:read"];
const SIGNER: Permission[] = [...VIEWER, "document:upload"];

/** ADMIN = SIGNER + user management. PUBLIC_VERIFIER never logs in; /api/verify is open. */
const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [...SIGNER, "user:manage"],
  SIGNER,
  VIEWER,
  PUBLIC_VERIFIER: [],
};

export const can = (role: Role, permission: Permission): boolean => MATRIX[role]?.includes(permission) ?? false;

/** Roles an admin may hand out. */
export const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "SIGNER", "VIEWER"];