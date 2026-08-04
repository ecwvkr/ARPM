import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

async function main() {
  const password = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@arpm.local" },
    update: {},
    create: {
      name: "총관리자",
      email: "admin@arpm.local",
      passwordHash: password,
      isSuperAdmin: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "kim@arpm.local" },
    update: {},
    create: {
      name: "김민수",
      email: "kim@arpm.local",
      passwordHash: password,
    },
  });

  await prisma.user.upsert({
    where: { email: "lee@arpm.local" },
    update: {},
    create: {
      name: "이서연",
      email: "lee@arpm.local",
      passwordHash: password,
    },
  });

  console.log("시드 완료: admin@arpm.local / kim@arpm.local / lee@arpm.local (비밀번호: password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
