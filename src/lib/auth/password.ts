import { hash, verify } from "argon2";

export const hashPassword = (password: string) => hash(password);

let dummyHash: Promise<string> | undefined;

/** Pass null when the user doesn't exist: still burns the same time as a real check. */
export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    dummyHash ??= hash("dummy-password");
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
