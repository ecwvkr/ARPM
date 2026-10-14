"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconLayoutGrid, IconChecklist, IconListCheck, IconBuilding, IconCalendar, IconMessage } from "@tabler/icons-react";
import { getRecentPartner, subscribeRecentPartner } from "@/lib/recent-partner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { partnerOptions } from "@/app/actions/partners";

function getServerSnapshot() {
  return null;
}

// 탭이 여섯이라 라벨 폭이 빡빡하므로 파트너명이 길면 줄인다.
function abbreviatePartnerName(name: string, max = 3) {
  return name.length > max ? `${name.slice(0, max)}···` : name;
}

const NAV_ITEM_CLASS =
  "flex w-full flex-col items-center gap-1 truncate px-1 py-2.5 text-xs";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const recentPartner = useSyncExternalStore(subscribeRecentPartner, getRecentPartner, getServerSnapshot);

  // 파트너를 옮겨 다닐 때마다 대시보드를 거치는 게 번거로워서, 파트너 탭을 누르면
  // 목록을 바로 띄운다. 목록은 열 때 한 번만 받아 온다.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [partners, setPartners] = useState<{ id: string; name: string; color: string | null }[] | null>(null);

  useEffect(() => {
    if (!pickerOpen || partners) return;
    let cancelled = false;
    partnerOptions()
      .then((list) => {
        if (!cancelled) setPartners(list);
      })
      .catch(() => {
        if (!cancelled) setPartners([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, partners]);

  const partnerActive = pathname.startsWith("/partners/");
  const partnerLabel = recentPartner ? `파트너(${abbreviatePartnerName(recentPartner.name)})` : "파트너";

  // 탭 순서대로 좌우 화살표로 옮겨 다닌다. 키보드를 쓰는 동안 손을 떼지 않아도 된다.
  const order = useMemo(
    () => ["/", recentPartner ? `/partners/${recentPartner.id}` : null, "/projects", "/tasks", "/comments", "/calendar"],
    [recentPartner],
  );
  const currentIndex = order.findIndex((href) =>
    href === "/" ? pathname === "/" : !!href && pathname.startsWith(href.split("?")[0]),
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      // 글을 쓰는 중이거나 조합키를 누른 상태면 화살표는 그쪽 몫이다. 이걸 안 보면
      // 코멘트를 쓰다가 커서를 옮기는 순간 다른 탭으로 튄다.
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      // 창이 떠 있으면(상세·설정 등) 그 안에서 쓰는 화살표일 수 있다.
      if (document.querySelector('[data-slot="dialog-content"], [role="dialog"]')) return;

      if (currentIndex < 0) return;
      const next = order[currentIndex + (e.key === "ArrowRight" ? 1 : -1)];
      if (!next) return;
      e.preventDefault();
      router.push(next);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, order, router]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
      <ul className="mx-auto flex max-w-5xl items-stretch justify-between">
        <NavLink label="홈" href="/" Icon={IconLayoutGrid} active={pathname === "/"} />

        <li className="flex-1">
          {/* 파트너 페이지 밖에서는 바로 마지막 파트너로 간다 — 하루에도 몇 번씩 쓰는
              길이라 한 번 더 고르게 할 이유가 없다. 이미 파트너 안이거나(=옮길 곳을
              찾는 중) 마지막 파트너가 없으면 목록을 띄운다. */}
          {!partnerActive && recentPartner ? (
            <Link
              href={`/partners/${recentPartner.id}`}
              className={`${NAV_ITEM_CLASS} text-muted-foreground`}
            >
              <IconBuilding className="size-5" />
              {partnerLabel}
            </Link>
          ) : (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className={`${NAV_ITEM_CLASS} ${partnerActive ? "font-bold text-primary" : "text-muted-foreground"}`}
                  >
                    <IconBuilding className="size-5" />
                    {partnerLabel}
                  </button>
                }
              />
              <PopoverContent side="top" align="center" className="max-h-[60vh] w-56 gap-1 overflow-y-auto p-2">
                {partners === null ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">불러오는 중...</p>
                ) : partners.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">참여 중인 파트너가 없습니다.</p>
                ) : (
                  partners.map((p) => (
                    <Link
                      key={p.id}
                      href={`/partners/${p.id}`}
                      onClick={() => setPickerOpen(false)}
                      className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-muted ${
                        p.id === recentPartner?.id && partnerActive ? "font-bold text-primary" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color ?? "transparent" }}
                      />
                      <span className="min-w-0 truncate">{p.name}</span>
                    </Link>
                  ))
                )}
              </PopoverContent>
            </Popover>
          )}
        </li>

        <NavLink label="전체 프로젝트" href="/projects" Icon={IconChecklist} active={pathname.startsWith("/projects")} />
        <NavLink label="태스크" href="/tasks" Icon={IconListCheck} active={pathname.startsWith("/tasks")} />
        {/* 설정은 상단 로고 메뉴로 옮겼다(components/app-logo-menu.tsx) — 자주 쓰지
            않는데 탭 하나를 차지하고 있었다. 그 자리에 코멘트를 둔다. */}
        <NavLink label="코멘트" href="/comments" Icon={IconMessage} active={pathname.startsWith("/comments")} />
        <NavLink label="캘린더" href="/calendar" Icon={IconCalendar} active={pathname.startsWith("/calendar")} />
      </ul>
    </nav>
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
