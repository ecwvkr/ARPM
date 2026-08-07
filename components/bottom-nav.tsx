"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLayoutGrid, IconChecklist, IconCalendar, IconSitemap, IconSettings } from "@tabler/icons-react";

const ITEMS = [
  { label: "대시보드", href: "/", icon: IconLayoutGrid, disabled: false },
  { label: "업무", href: "/tasks", icon: IconChecklist, disabled: false },
  { label: "캘린더", href: "/calendar", icon: IconCalendar, disabled: true },
  { label: "캔버스", href: "/canvas", icon: IconSitemap, disabled: true },
  { label: "설정", href: "/settings", icon: IconSettings, disabled: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
      <ul className="mx-auto flex max-w-5xl items-stretch justify-between">
        {ITEMS.map(({ label, href, icon: Icon, disabled }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          if (disabled) {
            return (
              <li key={label} className="flex-1">
                <span className="flex cursor-not-allowed flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground/40">
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
                className={`flex flex-col items-center gap-1 py-2.5 text-xs ${
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
