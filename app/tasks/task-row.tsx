"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleTask } from "@/app/actions/tasks";
import { IconCircle, IconCircleCheckFilled } from "@tabler/icons-react";
import type { GroupedTaskItem } from "@/lib/tasks";

// 태스크 탭 목록에서도 프로젝트 상세와 동일한 체크 인터랙션을 그대로 쓴다. 권한이
// 없는(참여하지 않는 공개 프로젝트) 태스크를 체크하면 서버가 막으므로 실패를 안내한다.
export function TaskRow({ projectId, partnerId, task }: { projectId: string; partnerId: string; task: GroupedTaskItem }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        await toggleTask(task.id);
      } catch {
        alert("변경할 수 없습니다. 권한을 확인하세요.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <button
        type="button"
        disabled={isPending}
        aria-label={task.done ? "완료 취소" : "완료 처리"}
        onClick={toggle}
        className={`shrink-0 ${task.done ? "text-primary" : "text-muted-foreground"}`}
      >
        {task.done ? <IconCircleCheckFilled className="size-4.5" /> : <IconCircle className="size-4.5" />}
      </button>
      <Link
        href={`/partners/${partnerId}?project=${projectId}`}
        className={`min-w-0 flex-1 truncate text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
      >
        {task.title}
      </Link>
    </div>
  );
}
