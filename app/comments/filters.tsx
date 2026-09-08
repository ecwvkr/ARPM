"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { COMMENT_FILTERS, type CommentFilter } from "@/lib/comment-filters";
import { chipClass } from "@/lib/ui";

const LAYOUTS = [
  { key: "group", label: "묶어보기" },
  { key: "flat", label: "개별" },
] as const;

// 필터와 보기 방식은 주소(?filter=, ?layout=)에 담는다. 목록을 서버에서 만들기 때문에
// 클라이언트에 상태를 들고 있으면 두 벌이 되고, 새로고침·뒤로가기에서 어긋난다.
export function CommentFilters({
  filter,
  layout,
}: {
  filter: CommentFilter;
  layout: "group" | "flat";
}) {
  const searchParams = useSearchParams();

  function hrefWith(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    // 상세 창이 열린 채로 목록을 바꾸면 창이 남으므로 함께 닫는다.
    params.delete("project");
    for (const [key, value] of Object.entries(changes)) params.set(key, value);
    return `?${params.toString()}`;
  }

  return (
    <div className="space-y-2">
      {/* 필터는 한 번에 하나만 — '전체'가 그중 하나라 겹쳐 쓸 수 없다. */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {COMMENT_FILTERS.map((item) => (
          <Link
            key={item.key}
            href={hrefWith({ filter: item.key })}
            scroll={false}
            className={chipClass(filter === item.key)}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {LAYOUTS.map((item) => (
          <Link
            key={item.key}
            href={hrefWith({ layout: item.key })}
            scroll={false}
            className={chipClass(layout === item.key)}
          >
            {item.label} 뷰
          </Link>
        ))}
      </div>
    </div>
  );
}
