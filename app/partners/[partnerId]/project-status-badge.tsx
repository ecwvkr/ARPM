"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateProjectStatus, completeProject, reopenProject } from "@/app/actions/projects";
import { STATUS_LABEL } from "@/lib/priority";

type Status = "TODO" | "IN_PROGRESS" | "DONE";
const STATUSES: Status[] = ["TODO", "IN_PROGRESS", "DONE"];

// 카드의 상태 배지를 눌러 바로 상태를 바꾼다 — 모바일에서는 그룹 간 드래그가
// 사실상 불가능하므로 이게 실질적인 상태 변경 수단이다.
export function ProjectStatusBadge({ projectId, status }: { projectId: string; status: Status }) {
  const [isPending, startTransition] = useTransition();

  async function change(target: Status) {
    if (target === status) return;
    try {
      if (target === "DONE") {
        await completeProject(projectId);
      } else if (status === "DONE") {
        await reopenProject(projectId); // completedAt 취소 + IN_PROGRESS로 되돌림
        if (target === "TODO") await updateProjectStatus(projectId, "TODO");
      } else {
        await updateProjectStatus(projectId, target);
      }
    } catch {
      alert("상태를 변경할 수 없습니다. 권한을 확인하세요.");
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" disabled={isPending} className="pointer-events-auto">
            <Badge variant={status === "DONE" ? "secondary" : "default"} className="cursor-pointer">
              {STATUS_LABEL[status]}
            </Badge>
          </button>
        }
      />
      <PopoverContent className="w-32 gap-0.5 p-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => change(s))}
            className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
              status === s ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
