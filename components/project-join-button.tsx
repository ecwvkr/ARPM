"use client";

import { useState, useTransition } from "react";
import { joinProject } from "@/app/actions/projects";
import { showToast } from "@/components/ui/global-toast";
import { IconUserPlus } from "@tabler/icons-react";

// 프로젝트 카드에서 바로 참여한다. 비공개 프로젝트는 애초에 미참여자 목록에 뜨지 않으므로
// 이 버튼은 공개 프로젝트에만 노출된다(참여 자격은 서버에서 한 번 더 확인한다).
export function ProjectJoinButton({ projectId }: { projectId: string }) {
  const [joined, setJoined] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (joined) return null;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        // 카드 전체를 덮은 상세보기 버튼으로 클릭이 전달되지 않도록 막는다.
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          try {
            await joinProject(projectId);
            setJoined(true);
            showToast("참여했습니다");
          } catch (err) {
            alert(err instanceof Error ? err.message : "참여할 수 없습니다.");
          }
        });
      }}
      className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/70 disabled:opacity-50"
    >
      <IconUserPlus className="size-3" />
      참여하기
    </button>
  );
}
