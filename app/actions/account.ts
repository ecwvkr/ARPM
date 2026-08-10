"use server";

import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function updateMyName(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return "이름을 입력하세요.";

  await prisma.user.update({ where: { id: session.user.id }, data: { name } });
  await unstable_update({ user: { name } });

  // ponytail: accentColor 저장 로직과 동일한 이유로 redirect를 써서 새 요청으로
  // 세션 쿠키가 즉시 반영되게 한다 (auth()는 같은 요청 안에서 메모이즈됨).
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function changeMyPassword(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const currentPassword = (formData.get("currentPassword") as string | null) ?? "";
  const newPassword = (formData.get("newPassword") as string | null) ?? "";
  if (newPassword.length < 8) return "새 비밀번호는 8자 이상이어야 합니다.";

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return "현재 비밀번호가 올바르지 않습니다.";

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });
}
