"use client";

import { useTransition } from "react";
import { setMyPriority } from "@/app/actions/projects";
import { PRIORITY_LABEL, PRIORITY_COLOR } from "@/lib/priority";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const LEVELS = ["URGENT", "NORMAL", "HOLD"] as const;

// 색만으로 구분하지 않도록 보류는 점선 테두리의 빈 원으로 그린다(색각 이상 대응).
export function PriorityDot({ level, className = "" }: { level: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 shrink-0 rounded-full border ${
        level === "HOLD" ? "border-dashed border-foreground/40" : "border-foreground/20"
      } ${className}`}
      style={{ backgroundColor: PRIORITY_COLOR[level] }}
    />
  );
}

// 참여자 이름 옆 우선순위 마크. 본인 것만 클릭해 팝오버로 즉시 변경할 수 있고,
// 타인 것은 정적 표시(툴팁)만 제공한다.
export function ParticipantPriorityDot({
  projectId,
  userId,
  userName,
  level,
  currentUserId,
}: {
  projectId: string;
  userId: string;
  userName: string;
  level: string;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (userId !== currentUserId) {
    return (
      <span title={`${userName}: ${PRIORITY_LABEL[level]}`} className="inline-flex">
        <PriorityDot level={level} className="translate-y-px" />
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={`내 우선순위: ${PRIORITY_LABEL[level]}`}
            aria-label={`내 우선순위: ${PRIORITY_LABEL[level]}`}
            className="inline-flex items-center"
          >
            <PriorityDot level={level} className="translate-y-px" />
          </button>
        }
      />
      <PopoverContent className="w-36 gap-0.5 p-1.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => setMyPriority(projectId, l))}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
              level === l ? "font-medium" : "text-muted-foreground"
            }`}
          >
            <PriorityDot level={l} />
            {PRIORITY_LABEL[l]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
