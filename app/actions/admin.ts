"use server";

import bcrypt from "bcrypt";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function createUserAccount(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return "총관리자만 계정을 생성할 수 있습니다.";

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim();
  const password = (formData.get("password") as string | null) ?? "";
  const isSuperAdmin = formData.get("isSuperAdmin") === "on";

  if (!name) return "이름을 입력하세요.";
  if (!email) return "이메일 또는 아이디를 입력하세요.";
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return "이미 사용 중인 이메일 또는 아이디입니다.";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, isSuperAdmin },
  });
}
