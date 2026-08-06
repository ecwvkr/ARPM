"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLayoutGrid, IconFolder, IconCalendar, IconSitemap, IconSettings } from "@tabler/icons-react";

const ITEMS = [
  { label: "대시보드", href: "/", icon: IconLayoutGrid },
  { label: "프로젝트", href: "/", icon: IconFolder },
  { label: "캘린더", href: "/calendar", icon: IconCalendar },
  { label: "캔버스", href: "/canvas", icon: IconSitemap },
  { label: "설정", href: "/settings", icon: IconSettings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs ${
                  active ? "text-foreground font-medium" : "text-muted-foreground"
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
