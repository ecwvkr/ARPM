"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { REMEMBERED_PARAMS, type ViewSection } from "@/lib/view-prefs-config";

// 화면에서 보기 설정을 바꿀 때마다 조용히 저장한다. 실패해도 화면은 그대로 돌아야
// 하므로 오류를 던지지 않는다 — 다음에 들어올 때 지난 설정이 안 뜰 뿐이다.
export async function saveViewPref(section: string, value: string) {
  if (!(section in REMEMBERED_PARAMS)) return;

  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.viewPreference.upsert({
    where: { userId_key: { userId: session.user.id, key: section as ViewSection } },
    update: { value },
    create: { userId: session.user.id, key: section, value },
  });
}
