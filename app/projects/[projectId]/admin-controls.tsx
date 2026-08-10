"use client";

import { toggleProjectArchive, softDeleteProject, restoreProject } from "@/app/actions/projects";
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

  return (
    <div className="flex items-center gap-2">
      <form action={toggleProjectArchive.bind(null, projectId)}>
        <Button type="submit" size="sm" variant="outline">
          {isArchived ? "숨김 해제" : "숨기기"}
        </Button>
      </form>
      <form
        action={softDeleteProject.bind(null, projectId)}
        onSubmit={(e) => {
          if (!confirm("이 프로젝트를 삭제하시겠습니까? (소프트 삭제)")) {
            e.preventDefault();
          }
        }}
      >
        <Button type="submit" size="sm" variant="destructive">
          삭제
        </Button>
      </form>
    </div>
  );
}
