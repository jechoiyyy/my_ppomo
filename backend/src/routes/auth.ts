import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types/auth.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { getUserId } from "../utils/request.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      res.status(401).json({ type: "about:blank", title: "Unauthorized", status: 401, detail: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ type: "about:blank", title: "Unauthorized", status: 401, detail: "Invalid credentials" });
      return;
    }

    const accessToken = createAccessToken(user.id);
    const refresh = createRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti: refresh.jti,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      accessToken,
      refreshToken: refresh.token,
      user: { id: user.id, email: user.email, timezone: user.timezone }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    const payload = verifyRefreshToken(body.refreshToken);

    const tokenRow = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!tokenRow || tokenRow.revoked || tokenRow.expiresAt < new Date()) {
      res.status(401).json({ type: "about:blank", title: "Unauthorized", status: 401, detail: "Refresh token is invalid" });
      return;
    }

    await prisma.refreshToken.update({ where: { jti: payload.jti }, data: { revoked: true } });

    const accessToken = createAccessToken(payload.sub);
    const refresh = createRefreshToken(payload.sub);

    await prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        jti: refresh.jti,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ accessToken, refreshToken: refresh.token });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    const payload = verifyRefreshToken(body.refreshToken);
    await prisma.refreshToken.updateMany({ where: { jti: payload.jti }, data: { revoked: true } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, timezone: true }
    });

    if (!user) {
      res.status(404).json({ type: "about:blank", title: "Not Found", status: 404, detail: "User not found" });
      return;
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
