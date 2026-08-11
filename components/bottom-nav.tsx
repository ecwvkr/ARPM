"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { IconLayoutGrid, IconChecklist, IconCalendar, IconSettings } from "@tabler/icons-react";
import { getRecentProject, subscribeRecentProject } from "@/lib/recent-project";

function getServerSnapshot() {
  return null;
}

const BASE_ITEMS = [
  { label: "대시보드", href: "/", icon: IconLayoutGrid, disabled: false },
  { label: "캘린더", href: "/calendar", icon: IconCalendar, disabled: false },
  { label: "설정", href: "/settings", icon: IconSettings, disabled: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const recentProject = useSyncExternalStore(subscribeRecentProject, getRecentProject, getServerSnapshot);

  // 탭은 항상 전체 업무로 간다. 프로젝트명은 지금 그 프로젝트를 보고 있을 때만
  // 붙인다 — 전체 업무 화면에서까지 붙으면 그 프로젝트만 보는 것처럼 읽힌다.
  const inProject = pathname.startsWith("/projects/");
  const tasksItem = {
    label: inProject && recentProject ? `업무 (${recentProject.name})` : "업무",
    href: "/tasks",
  };

  const items = [
    BASE_ITEMS[0],
    { ...tasksItem, icon: IconChecklist, disabled: false as const },
    ...BASE_ITEMS.slice(1),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
      <ul className="mx-auto flex max-w-5xl items-stretch justify-between">
        {items.map(({ label, href, icon: Icon, disabled }) => {
          const basePath = href.split("?")[0];
          const active = basePath === "/" ? pathname === "/" : pathname.startsWith(basePath);
          if (disabled) {
            return (
              <li key={label} className="flex-1">
                <span
                  aria-disabled="true"
                  title="준비 중"
                  className="flex cursor-not-allowed flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground/40"
                >
                  <Icon className="size-5" />
                  {label}
                </span>
              </li>
            );
          }
          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 truncate px-1 py-2.5 text-xs ${
                  active ? "font-bold text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
