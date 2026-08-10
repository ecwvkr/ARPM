import { prisma } from "@/lib/prisma";

const DEFAULT_COMMENT_VISIBLE_COUNT = 5;

// AppSetting은 항상 단일 행. 아직 아무도 저장한 적이 없으면 기본값을 쓴다(시드 불필요).
export async function getCommentVisibleCount(): Promise<number> {
  const setting = await prisma.appSetting.findFirst();
  return setting?.commentVisibleCount ?? DEFAULT_COMMENT_VISIBLE_COUNT;
}
