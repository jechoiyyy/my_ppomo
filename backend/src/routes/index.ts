import { Router } from "express";
import authRouter from "./auth.js";
import tasksRouter from "./tasks.js";
import sessionsRouter from "./sessions.js";
import statsRouter from "./stats.js";
import settingsRouter from "./settings.js";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/sessions", sessionsRouter);
apiRouter.use("/stats", statsRouter);
apiRouter.use("/settings", settingsRouter);

export default apiRouter;
