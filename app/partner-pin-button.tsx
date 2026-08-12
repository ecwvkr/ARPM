"use client";

import { useTransition } from "react";
import { togglePartnerPin } from "@/app/actions/partners";
import { IconPin, IconPinFilled } from "@tabler/icons-react";

export function PartnerPinButton({ partnerId, pinned }: { partnerId: string; pinned: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      title={pinned ? "즐겨찾기 해제" : "즐겨찾기 고정"}
      aria-label={pinned ? "즐겨찾기 해제" : "즐겨찾기 고정"}
      aria-pressed={pinned}
      onClick={() => startTransition(() => togglePartnerPin(partnerId))}
      className={`relative z-10 flex size-7 items-center justify-center rounded-full bg-background ${
        pinned ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {pinned ? <IconPinFilled className="size-4" /> : <IconPin className="size-4" />}
    </button>
  );
}
