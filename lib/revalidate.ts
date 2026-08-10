import { revalidatePath } from "next/cache";

// 업무 데이터는 프로젝트 상세뿐 아니라 전체 업무·캘린더·대시보드에도 같은 데이터가
// 다른 모양으로 노출되므로, 업무를 바꾸는 액션은 항상 이 헬퍼로 관련 화면을 함께 무효화한다.
export function revalidateTaskViews(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}
