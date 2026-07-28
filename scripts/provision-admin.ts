// Creates (or updates the password on) the admin account. Run once against
// production after setting ADMIN_USERNAME in the environment — the account
// this creates is the only one that can ever be treated as admin (signup
// rejects anyone else registering that exact username, see
// src/lib/admin.ts's isReservedUsername).
//
// Usage:
//   ADMIN_USERNAME="..." ADMIN_PASSWORD="..." DATABASE_URL="<prod-url>" npx tsx scripts/provision-admin.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("Set both ADMIN_USERNAME and ADMIN_PASSWORD before running this.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD is too short.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, name: username, passwordHash },
    });
    console.log(`Admin account ready: username="${username}" (id ${user.id}).`);
    console.log("Make sure ADMIN_USERNAME is also set in the app's own environment (Vercel) —");
    console.log("that's what actually grants the admin UI, this script only sets the password.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
