"use client";

import { useState, useTransition } from "react";
import { requestPartnerJoin } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/global-toast";
import { IconUserPlus, IconClock } from "@tabler/icons-react";

// 볼 수는 있지만 아직 참여하지 않은 파트너에 참여를 신청한다. 관리자가 수락해야
// 실제 멤버가 되므로, 누른 뒤에는 '승인 대기중'으로 바뀌어 중복 신청을 막는다.
export function PartnerJoinButton({
  partnerId,
  requested,
  className = "",
  size = "sm",
}: {
  partnerId: string;
  requested: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  const [sent, setSent] = useState(requested);
  const [isPending, startTransition] = useTransition();

  if (sent) {
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
      disabled={isPending}
      className={className}
      onClick={(e) => {
        // 카드 배경 링크로 클릭이 전달되지 않도록 막는다.
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          try {
            await requestPartnerJoin(partnerId);
            setSent(true);
            showToast("참여를 신청했습니다");
          } catch (err) {
            alert(err instanceof Error ? err.message : "신청할 수 없습니다.");
          }
        });
      }}
    >
      <IconUserPlus className="size-3.5" />
      업무 참여하기
    </Button>
  );
}
