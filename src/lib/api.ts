import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Typed error carrying an HTTP status (used by auth/access helpers).
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Tiny response helpers for route handlers.
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ ok: false, error: message, details: extra }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) {
    return fail(err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return fail("Validation failed", 422, err.flatten());
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api] error:", err);
  return fail(message, 500);
}
