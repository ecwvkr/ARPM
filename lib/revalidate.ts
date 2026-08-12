import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// 프로젝트 데이터는 파트너 상세뿐 아니라 전체 프로젝트·캘린더·대시보드에도 같은 데이터가
// 다른 모양으로 노출되므로, 프로젝트를 바꾸는 액션은 항상 이 헬퍼로 관련 화면을 함께 무효화한다.
// 이 함수가 곧 "프로젝트를 실제로 바꾼 지점" 전부이므로, 대시보드 정렬용
// Partner.lastActivityAt 갱신도 여기 하나에 묶는다. 단순 조회(getProjectDetail의
// 읽음 처리)처럼 "활동"으로 칠 수 없는 경우에만 touch: false를 넘긴다.
export async function revalidateProjectViews(partnerId: string, { touch = true }: { touch?: boolean } = {}) {
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/projects");
  revalidatePath("/calendar");
  revalidatePath("/");
  if (touch) {
    await prisma.partner.update({ where: { id: partnerId }, data: { lastActivityAt: new Date() } });
  }
}
