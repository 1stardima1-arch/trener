// This app has no static content bank to seed (plans, activities and
// insights are all generated per-athlete at runtime) — the only thing this
// script does is provision the admin account, so ADMIN_USERNAME +
// ADMIN_PASSWORD in the environment is enough to get admin access with
// zero manual steps, the same way it worked before. Runs on every deploy
// (see package.json `build`), safe to re-run any number of times.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    const username = process.env.ADMIN_USERNAME.trim();
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, name: username, passwordHash },
    });
    console.log(`  ✓ Админ-аккаунт «${username}» готов.`);
  } else {
    console.log("  · ADMIN_USERNAME/ADMIN_PASSWORD не заданы — пропускаю создание админ-аккаунта.");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
