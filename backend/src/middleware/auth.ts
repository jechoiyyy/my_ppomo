import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthRequest } from "../types/auth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Missing bearer token"
    });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    (req as AuthRequest).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid access token"
    });
  }
}
