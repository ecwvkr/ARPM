import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 프로필 사진은 User.avatarUrl에 data URI로 저장하고 이미지 응답은 여기서만 만든다.
// 참여자 칩은 카드마다 반복되므로 data URI를 그대로 페이지 페이로드에 실으면
// 수십 KB짜리 문자열이 사람 수 × 카드 수만큼 복제된다.
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  // 팀 내부 사진이므로 로그인한 사용자에게만 내려준다.
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });

  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  const match = user?.avatarUrl?.match(/^data:(image\/[a-z]+);base64,(.+)$/);

  // 아바타 요청 1건이 곧 Vercel 함수 호출 1건이고, 참여자 칩은 화면마다 반복된다.
  // 주소에 버전(?v=사진이 바뀐 시각)이 붙어 있으므로 오래 캐시해도 안전하다 — 사진을
  // 바꾸면 주소 자체가 달라져 다음 화면 진입 때 새로 받아 간다.
  // 사진이 없는 사용자는 애초에 요청이 오지 않는다(components/avatar-provider.tsx).
  if (!match) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=60" } });
  }

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
