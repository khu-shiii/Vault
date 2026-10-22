import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

type Handler = (req: Request, ctx: any) => Promise<Response>;

/** Wraps a route handler: ApiError -> JSON error, anything else -> 500. */
export function handle(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(
          { success: false, error: { code: e.code, message: e.message } },
          { status: e.status }
        );
      }
      console.error(e);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL", message: "Internal server error" } },
        { status: 500 }
      );
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Reads the multipart field "file" with size checks. */
export async function readFileUpload(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !file || typeof file === "string") {
    throw new ApiError(400, "BAD_REQUEST", "A file is required (multipart field 'file')");
  }
  if (file.size === 0) throw new ApiError(400, "BAD_REQUEST", "File is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "Max file size is 20 MB");
  return { form, name: file.name, type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
}
