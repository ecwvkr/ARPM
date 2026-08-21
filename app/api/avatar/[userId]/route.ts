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

  // 사진이 없는 사용자도 칩마다 요청이 오므로 404에도 캐시를 붙여 재요청을 막는다.
  if (!match) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
  }

  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=300" },
  });
}
