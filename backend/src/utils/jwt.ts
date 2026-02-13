import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function createAccessToken(userId: string): string {
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn
  });
}

export function createRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn
  });
  return { token, jti };
}

export function verifyRefreshToken(token: string): { sub: string; jti: string; exp: number } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; jti: string; exp: number };
}
