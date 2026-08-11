"use client";

import { toggleProjectArchive, restoreProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

export function AdminControls({
  projectId,
  isArchived,
  isDeleted,
}: {
  projectId: string;
  isArchived: boolean;
  isDeleted: boolean;
}) {
  if (isDeleted) {
    return (
      <form action={restoreProject.bind(null, projectId)}>
        <Button type="submit" size="sm" variant="outline">
          복구
        </Button>
      </form>
    );
  }

  // 삭제는 프로젝트 설정 팝업으로 옮겼다(owner도 삭제 가능). 여기는 총관리자 전용 숨김/복구만.
  return (
    <form action={toggleProjectArchive.bind(null, projectId)}>
      <Button type="submit" size="sm" variant="outline">
        {isArchived ? "숨김 해제" : "숨기기"}
      </Button>
    </form>
  );
}
