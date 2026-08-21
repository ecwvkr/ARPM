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

// 프로필 사진. 클라이언트에서 128px 정사각형 JPEG로 줄여 data URI로 보내오고,
// 여기서는 형식·크기만 검증해 저장한다(이미지 응답은 /api/avatar/[userId]가 만든다).
const AVATAR_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const AVATAR_MAX_LENGTH = 200_000;

export async function updateMyAvatar(dataUrl: string | null) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (dataUrl !== null) {
    if (!AVATAR_DATA_URL.test(dataUrl)) return "이미지 파일을 올려주세요.";
    if (dataUrl.length > AVATAR_MAX_LENGTH) return "이미지가 너무 큽니다.";
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { avatarUrl: dataUrl } });
  // 아바타는 모든 화면의 참여자 칩에 나오므로 레이아웃 단위로 다시 그린다.
  revalidatePath("/", "layout");
}
