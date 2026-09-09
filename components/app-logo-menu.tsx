"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { signOutAction } from "@/app/actions/auth";
import { IconSettings, IconLogout } from "@tabler/icons-react";

const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted";

// 상단 바 왼쪽에 늘 있는 앱 아이콘. 누르면 설정·로그아웃이 나온다.
//
// 이 둘은 자주 쓰지 않는데 화면마다 버튼 자리를 차지하고 있었다(설정은 하단 탭까지
// 하나 먹었다). 늘 같은 자리에 있는 로고 아래로 모아 두면 어느 화면에서든 찾는 곳이
// 하나가 된다.
export function AppLogoMenu() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="메뉴 열기"
            className="shrink-0 rounded-full transition-opacity hover:opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 고정 크기 정적 아이콘이라 최적화할 게 없다. */}
            <img src="/icon.svg" alt="" aria-hidden className="size-11 rounded-full" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-40 gap-0.5 p-1.5">
        <Link href="/settings" onClick={() => setOpen(false)} className={MENU_ITEM}>
          <IconSettings className="size-4 text-muted-foreground" />
          설정
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => { await signOutAction(); })}
          className={MENU_ITEM}
        >
          <IconLogout className="size-4 text-muted-foreground" />
          로그아웃
        </button>
      </PopoverContent>
    </Popover>
  );
}
