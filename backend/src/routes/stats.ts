import { SessionType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types/auth.js";
import { dayBoundsUtc, weekBoundsUtc } from "../utils/date.js";
import { getUserId } from "../utils/request.js";

const router = Router();
router.use(requireAuth);

router.get("/daily", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const { date } = z.object({ date: z.string().date() }).parse(req.query);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { start, end } = dayBoundsUtc(date, user.timezone);

    const [sessions, completedTasks] = await Promise.all([
      prisma.pomodoroSession.findMany({
        where: {
          userId,
          sessionType: SessionType.focus,
          status: "completed",
          endedAt: { gte: start, lt: end }
        }
      }),
      prisma.task.count({
        where: { userId, status: "done", completedAt: { gte: start, lt: end } }
      })
    ]);

    const focusCount = sessions.length;
    const totalFocusMinutes = Math.floor(
      sessions.reduce((sum: number, s: { durationSec: number }) => sum + s.durationSec, 0) / 60
    );

    res.json({ date, focusCount, totalFocusMinutes, completedTasks });
  } catch (error) {
    next(error);
  }
});

router.get("/weekly", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const { start } = z.object({ start: z.string().date() }).parse(req.query);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const bounds = weekBoundsUtc(start, user.timezone);

    const sessions = await prisma.pomodoroSession.findMany({
      where: {
        userId,
        sessionType: SessionType.focus,
        status: "completed",
        endedAt: { gte: bounds.start, lt: bounds.end }
      },
      select: { endedAt: true, durationSec: true }
    });

    const grouped: Record<string, number> = {};
    for (const item of sessions) {
      if (!item.endedAt) continue;
      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: user.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
        .format(item.endedAt)
        .replace(/\//g, "-");
      grouped[key] = (grouped[key] ?? 0) + Math.floor(item.durationSec / 60);
    }

    res.json({ start, days: grouped });
  } catch (error) {
    next(error);
  }
});

export default router;
