"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { IconLayoutGrid, IconChecklist, IconListCheck, IconBuilding, IconCalendar, IconSettings } from "@tabler/icons-react";
import { getRecentPartner, subscribeRecentPartner } from "@/lib/recent-partner";
import { useSavedToast } from "@/components/ui/saved-toast";

function getServerSnapshot() {
  return null;
}

// 6탭은 라벨 폭이 빡빡하므로 파트너명이 길면 줄인다.
function abbreviatePartnerName(name: string, max = 3) {
  return name.length > max ? `${name.slice(0, max)}···` : name;
}

const NAV_ITEM_CLASS =
  "flex w-full flex-col items-center gap-1 truncate px-1 py-2.5 text-xs";

export function BottomNav() {
  const pathname = usePathname();
  const recentPartner = useSyncExternalStore(subscribeRecentPartner, getRecentPartner, getServerSnapshot);
  const { toast, trigger: showNoPartnerToast } = useSavedToast("대시보드에서 파트너를 먼저 선택해 주세요");

  const partnerActive = pathname.startsWith("/partners/");
  const partnerLabel = recentPartner ? `파트너(${abbreviatePartnerName(recentPartner.name)})` : "파트너";

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
        <ul className="mx-auto flex max-w-5xl items-stretch justify-between">
          <NavLink label="홈" href="/" Icon={IconLayoutGrid} active={pathname === "/"} />

          <li className="flex-1">
            {recentPartner ? (
              <Link
                href={`/partners/${recentPartner.id}`}
                className={`${NAV_ITEM_CLASS} ${partnerActive ? "font-bold text-primary" : "text-muted-foreground"}`}
              >
                <IconBuilding className="size-5" />
                {partnerLabel}
              </Link>
            ) : (
              <button type="button" onClick={showNoPartnerToast} className={`${NAV_ITEM_CLASS} text-muted-foreground`}>
                <IconBuilding className="size-5" />
                파트너
              </button>
            )}
          </li>

          <NavLink label="전체 프로젝트" href="/projects" Icon={IconChecklist} active={pathname.startsWith("/projects")} />
          <NavLink label="태스크" href="/tasks" Icon={IconListCheck} active={pathname.startsWith("/tasks")} />
          <NavLink label="캘린더" href="/calendar" Icon={IconCalendar} active={pathname.startsWith("/calendar")} />
          <NavLink label="설정" href="/settings" Icon={IconSettings} active={pathname.startsWith("/settings")} />
        </ul>
      </nav>
      {toast}
    </>
  );
}

function NavLink({
  label,
  href,
  Icon,
  active,
}: {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link href={href} className={`${NAV_ITEM_CLASS} ${active ? "font-bold text-primary" : "text-muted-foreground"}`}>
        <Icon className="size-5" />
        {label}
      </Link>
    </li>
  );
}
