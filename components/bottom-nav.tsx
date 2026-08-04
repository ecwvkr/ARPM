"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Folder, Calendar, Waypoints, Settings } from "lucide-react";

const ITEMS = [
  { label: "대시보드", href: "/", icon: LayoutGrid },
  { label: "프로젝트", href: "/", icon: Folder },
  { label: "캘린더", href: null, icon: Calendar },
  { label: "캔버스", href: null, icon: Waypoints },
  { label: "설정", href: "/settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] bg-background">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const active = href !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          if (href === null) {
            return (
              <li key={label} className="flex-1">
                <span
                  title="준비 중입니다"
                  className="flex cursor-not-allowed flex-col items-center gap-1 py-2.5 text-muted-foreground/40"
                >
                  <Icon className="size-5" />
                  <span className="text-xs">{label}</span>
                </span>
              </li>
            );
          }
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
