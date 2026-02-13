import { TaskPriority, TaskStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types/auth.js";
import { dateInTimezone } from "../utils/date.js";
import { getUserId } from "../utils/request.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const query = z
      .object({
        filter: z.enum(["today", "tomorrow", "all", "completed"]).default("all"),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20)
      })
      .parse(req.query);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const where: Record<string, unknown> = { userId };

    if (query.filter === "today") {
      where.plannedDate = new Date(dateInTimezone(user.timezone));
      where.status = { not: "done" };
    }

    if (query.filter === "tomorrow") {
      where.plannedDate = new Date(dateInTimezone(user.timezone, 1));
      where.status = { not: "done" };
    }

    if (query.filter === "completed") {
      where.status = "done";
    }

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
      }),
      prisma.task.count({ where })
    ]);

    res.json({ items, page: query.page, pageSize: query.pageSize, total });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const body = z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        priority: z.nativeEnum(TaskPriority).default(TaskPriority.medium),
        plannedDate: z.string().date().optional(),
        estimatePomodoros: z.number().int().min(0).default(1)
      })
      .parse(req.body);

    const task = await prisma.task.create({
      data: {
        userId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        estimatePomodoros: body.estimatePomodoros,
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : null
      }
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId } });
    if (!task) {
      res.status(404).json({ type: "about:blank", title: "Not Found", status: 404, detail: "Task not found" });
      return;
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        status: z.nativeEnum(TaskStatus).optional(),
        plannedDate: z.string().date().nullable().optional(),
        estimatePomodoros: z.number().int().min(0).optional(),
        completedPomodoros: z.number().int().min(0).optional(),
        version: z.number().int().min(1)
      })
      .parse(req.body);

    const current = await prisma.task.findFirst({ where: { id: req.params.id, userId } });
    if (!current) {
      res.status(404).json({ type: "about:blank", title: "Not Found", status: 404, detail: "Task not found" });
      return;
    }

    if (current.version !== body.version) {
      res.status(409).json({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        detail: "다른 PC에서 변경됨. 최신 데이터로 갱신합니다.",
        code: "STALE_DATA",
        latest: current
      });
      return;
    }

    const updated = await prisma.task.update({
      where: { id: current.id },
      data: {
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: body.status,
        plannedDate: body.plannedDate === undefined ? undefined : body.plannedDate ? new Date(body.plannedDate) : null,
        estimatePomodoros: body.estimatePomodoros,
        completedPomodoros: body.completedPomodoros,
        completedAt: body.status === TaskStatus.done ? new Date() : null,
        version: { increment: 1 }
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const userId = getUserId(req);
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true }
    });

    if (!task) {
      res.status(404).json({ type: "about:blank", title: "Not Found", status: 404, detail: "Task not found" });
      return;
    }

    await prisma.$transaction([
      prisma.pomodoroSession.deleteMany({
        where: { userId, taskId: task.id }
      }),
      prisma.task.delete({
        where: { id: task.id }
      })
    ]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
