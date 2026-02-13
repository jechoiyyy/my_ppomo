import type { AuthRequest } from "../types/auth.js";

export function getUserId(req: AuthRequest): string {
  if (!req.userId) {
    throw new Error("Missing authenticated user context");
  }
  return req.userId;
}
