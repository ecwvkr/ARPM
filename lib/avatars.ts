import { prisma } from "@/lib/prisma";

// 프로필 사진이 있는 사용자와 그 사진의 버전. 레이아웃이 한 번 읽어 화면 전체에
// 내려 준다(components/avatar-provider.tsx).
//
// avatarUrl 자체는 data URI라 6KB쯤 되고, 페이지 페이로드에 그대로 실으면 사람 수만큼
// 복제된다. 그래서 여기서는 "있다/없다"와 버전만 가져오고 이미지는 /api/avatar가 준다.
export async function listAvatarVersions(): Promise<Record<string, string>> {
  const users = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, avatarUpdatedAt: true },
  });

  return Object.fromEntries(
    // 마이그레이션 이전에 올린 사진은 시각이 비어 있을 수 있다 — 그때는 고정값을 쓴다.
    users.map((u) => [u.id, String(u.avatarUpdatedAt?.getTime() ?? 0)]),
  );
}
