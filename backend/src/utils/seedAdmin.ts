import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export async function seedAdmin(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL,
      passwordHash,
      timezone: "Asia/Seoul",
      settings: { create: {} }
    }
  });

  console.log(`Seeded admin user: ${user.email}`);
}

if (process.argv[1]?.includes("seedAdmin")) {
  seedAdmin()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
