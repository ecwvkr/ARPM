"use client";

import { useState, useTransition } from "react";
import { joinPartner } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/global-toast";
import { IconUserPlus, IconClock } from "@tabler/icons-react";

// 공개 파트너는 눌러서 바로 참여되고, 비공개 파트너는 관리자 승인을 기다린다.
// 승인 대기 상태에서는 버튼 대신 '승인 대기중'을 보여줘 중복 신청을 막는다.
export function PartnerJoinButton({
  partnerId,
  isPublic,
  requested,
  className = "",
  size = "sm",
}: {
  partnerId: string;
  isPublic: boolean;
  requested: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  const [pending, setPending] = useState(requested);
  const [isPendingAction, startTransition] = useTransition();

  if (pending) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground ${className}`}
      >
        <IconClock className="size-3.5" />
        승인 대기중
      </span>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      disabled={isPendingAction}
      className={className}
      onClick={(e) => {
        // 카드 배경 링크로 클릭이 전달되지 않도록 막는다.
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          try {
            const result = await joinPartner(partnerId);
            if (result.joined) showToast("참여했습니다");
            else {
              setPending(true);
              showToast("참여를 신청했습니다");
            }
          } catch (err) {
            alert(err instanceof Error ? err.message : "참여할 수 없습니다.");
          }
        });
      }}
    >
      <IconUserPlus className="size-3.5" />
      {isPublic ? "참여하기" : "참여 요청"}
    </Button>
  );
}
