import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { errorHandler, notFound } from "./middleware/error.js";
import apiRouter from "./routes/index.js";
import { seedAdmin } from "./utils/seedAdmin.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(errorHandler);

async function main() {
  await seedAdmin();
  app.listen(env.PORT, () => {
    console.log(`Backend listening on port ${env.PORT}`);
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
