import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProjectToGoogle } from "@/lib/google/calendar";

// 프로젝트 데이터는 파트너 상세뿐 아니라 전체 프로젝트·캘린더·대시보드에도 같은 데이터가
// 다른 모양으로 노출되므로, 프로젝트를 바꾸는 액션은 항상 이 헬퍼로 관련 화면을 함께 무효화한다.
// 이 함수가 곧 "프로젝트를 실제로 바꾼 지점" 전부이므로, 대시보드 정렬용
// Partner.lastActivityAt 갱신과 구글 캘린더 내보내기(G4)도 여기 하나에 묶는다. 단순 조회
// (getProjectDetail의 읽음 처리)처럼 "활동"으로 칠 수 없는 경우에만 touch: false를 넘긴다.
// syncProjectIds는 title/dueDate/visibility/보관 여부처럼 구글에 내보낸 내용에 실제로
// 영향을 주는 필드가 바뀐 프로젝트 id만 넘긴다(참여자·코멘트·우선순위 등은 넘길 필요 없다).
export async function revalidateProjectViews(
  partnerId: string,
  { touch = true, syncProjectIds = [] }: { touch?: boolean; syncProjectIds?: string[] } = {},
) {
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/projects");
  revalidatePath("/calendar");
  revalidatePath("/");
  if (touch) {
    await prisma.partner.update({ where: { id: partnerId }, data: { lastActivityAt: new Date() } });
  }
  if (syncProjectIds.length > 0) {
    // 구글 API 왕복으로 저장 응답이 늦어지면 안 되므로 응답을 보낸 뒤 실행한다.
    // 실패(연결 없음·토큰 만료 등)는 syncProjectToGoogle 내부에서 조용히 넘어간다.
    after(() => Promise.allSettled(syncProjectIds.map((id) => syncProjectToGoogle(id))));
  }
}
