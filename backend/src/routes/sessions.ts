import { SessionStatus, SessionType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types/auth.js";
import { getUserId } from "../utils/request.js";

const router = Router();
router.use(requireAuth);

router.post("/start", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const body = z
      .object({
        taskId: z.string().uuid().nullable().optional(),
        sessionType: z.nativeEnum(SessionType),
        durationSec: z.number().int().positive(),
        startedAt: z.string().datetime().optional()
      })
      .parse(req.body);

    const session = await prisma.pomodoroSession.create({
      data: {
        userId,
        taskId: body.taskId ?? null,
        sessionType: body.sessionType,
        durationSec: body.durationSec,
        startedAt: body.startedAt ? new Date(body.startedAt) : new Date()
      }
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/complete", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const body = z.object({ endedAt: z.string().datetime().optional() }).parse(req.body ?? {});

    const existing = await prisma.pomodoroSession.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) {
      res.status(404).json({ type: "about:blank", title: "Not Found", status: 404, detail: "Session not found" });
      return;
    }

    if (existing.status !== SessionStatus.in_progress) {
      res.status(409).json({ type: "about:blank", title: "Conflict", status: 409, detail: "Session already finalized" });
      return;
    }

    const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
    if (endedAt <= existing.startedAt) {
      res.status(422).json({ type: "about:blank", title: "Validation Error", status: 422, detail: "endedAt must be after startedAt" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.pomodoroSession.update({
        where: { id: existing.id },
        data: {
          endedAt,
          completed: true,
          status: SessionStatus.completed
        }
      });

      if (updated.sessionType === SessionType.focus && updated.taskId) {
        await tx.task.update({
          where: { id: updated.taskId },
          data: { completedPomodoros: { increment: 1 }, version: { increment: 1 } }
        });
      }

      return updated;
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const existing = await prisma.pomodoroSession.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) {
      res.status(404).json({ type: "about:blank", title: "Not Found", status: 404, detail: "Session not found" });
      return;
    }

    if (existing.status !== SessionStatus.in_progress) {
      res.status(409).json({ type: "about:blank", title: "Conflict", status: 409, detail: "Session already finalized" });
      return;
    }

    const updated = await prisma.pomodoroSession.update({
      where: { id: existing.id },
      data: { endedAt: new Date(), status: SessionStatus.cancelled, cancelledBy: "user" }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/recovery/reset", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const result = await prisma.pomodoroSession.updateMany({
      where: { userId, status: SessionStatus.in_progress },
      data: { status: SessionStatus.cancelled, cancelledBy: "recovery", endedAt: new Date() }
    });

    res.json({ resetCount: result.count, timerState: "short_break" });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const query = z
      .object({
        from: z.string().date(),
        to: z.string().date(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(50)
      })
      .parse(req.query);

    const from = new Date(query.from);
    const to = new Date(query.to);

    const where = {
      userId,
      startedAt: {
        gte: from,
        lt: to
      }
    };

    const [items, total] = await Promise.all([
      prisma.pomodoroSession.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { startedAt: "desc" }
      }),
      prisma.pomodoroSession.count({ where })
    ]);

    res.json({ items, page: query.page, pageSize: query.pageSize, total });
  } catch (error) {
    next(error);
  }
});

export default router;
