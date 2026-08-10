"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateAccentColor(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const reset = formData.get("reset") === "1";
  const raw = (formData.get("accentColor") as string | null)?.trim();

  if (!reset && !HEX_COLOR.test(raw ?? "")) return "올바른 색상 값을 선택하세요.";

  const accentColor = reset ? null : (raw ?? null);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { accentColor },
  });
  await unstable_update({ user: { accentColor } });

  // ponytail: auth()는 요청 안에서 세션을 메모이즈하므로, 방금 갱신한 세션 쿠키는
  // 같은 요청의 revalidatePath 재렌더에는 반영되지 않는다. redirect로 완전히 새
  // 요청을 만들어야 즉시 반영된다(검증 완료).
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function updateCommentVisibleCount(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return "총관리자만 변경할 수 있습니다.";

  const count = Number(formData.get("commentVisibleCount"));
  if (!Number.isInteger(count) || count < 1) return "1 이상의 정수를 입력하세요.";

  const existing = await prisma.appSetting.findFirst();
  if (existing) {
    await prisma.appSetting.update({ where: { id: existing.id }, data: { commentVisibleCount: count } });
  } else {
    await prisma.appSetting.create({ data: { commentVisibleCount: count } });
  }
  revalidatePath("/settings");
}
