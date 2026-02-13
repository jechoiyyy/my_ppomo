import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types/auth.js";
import { getUserId } from "../utils/request.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const setting = await prisma.userSetting.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    if (!setting) {
      res.json({
        focusMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
        longBreakInterval: 4,
        autoStartBreak: false,
        autoStartFocus: false,
        soundEnabled: true,
        timezone: user?.timezone ?? "Asia/Seoul"
      });
      return;
    }
    res.json({ ...setting, timezone: user?.timezone ?? "Asia/Seoul" });
  } catch (error) {
    next(error);
  }
});

router.patch("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const body = z
      .object({
        focusMin: z.number().int().min(1).max(120).optional(),
        shortBreakMin: z.number().int().min(1).max(60).optional(),
        longBreakMin: z.number().int().min(1).max(120).optional(),
        longBreakInterval: z.number().int().min(2).max(10).optional(),
        autoStartBreak: z.boolean().optional(),
        autoStartFocus: z.boolean().optional(),
        soundEnabled: z.boolean().optional(),
        timezone: z.string().min(3).optional()
      })
      .parse(req.body);

    const { timezone, ...settingInput } = body;

    const [setting] = await prisma.$transaction([
      prisma.userSetting.upsert({
        where: { userId },
        create: { userId, ...settingInput },
        update: settingInput
      }),
      prisma.user.update({
        where: { id: userId },
        data: timezone ? { timezone } : {}
      })
    ]);

    res.json(setting);
  } catch (error) {
    next(error);
  }
});

export default router;
