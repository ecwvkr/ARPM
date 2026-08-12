import { revalidatePath } from "next/cache";

// 프로젝트 데이터는 파트너 상세뿐 아니라 전체 프로젝트·캘린더·대시보드에도 같은 데이터가
// 다른 모양으로 노출되므로, 프로젝트를 바꾸는 액션은 항상 이 헬퍼로 관련 화면을 함께 무효화한다.
export function revalidateProjectViews(partnerId: string) {
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/projects");
  revalidatePath("/calendar");
  revalidatePath("/");
}
