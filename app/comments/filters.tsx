"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STATUS_LABEL } from "@/lib/priority";
import { chipClass } from "@/lib/ui";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

// 필터는 주소(?status=, ?mine=)에 담는다. 서버에서 목록을 만들기 때문에 상태를
// 클라이언트에 들고 있으면 두 벌이 되고, 새로고침·뒤로가기에서 어긋난다.
//
// f=1은 "사용자가 필터를 한 번이라도 건드렸다"는 표시다. 이게 없으면 기본값
// (진행전+진행중 / 내 프로젝트)을 적용하고, 있으면 비어 있는 것도 사용자의 선택으로
// 존중한다 — 없으면 전부 끄는 순간 기본값이 되살아나 꺼지지 않는다.
export function CommentFilters({
  selectedStatuses,
  mineOnly,
}: {
  selectedStatuses: string[];
  mineOnly: boolean;
}) {
  const searchParams = useSearchParams();

  function hrefWith(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    // 아직 주소에 안 적힌 필터는 지금 적용 중인 값으로 먼저 채운다. f=1을 붙이는 순간
    // 기본값이 더는 안 먹으므로, 이걸 안 하면 한쪽을 건드릴 때 다른 쪽이 조용히 풀린다
    // ('내 프로젝트'를 껐더니 상태 필터까지 전부 풀리던 문제).
    if (!params.has("status") && selectedStatuses.length > 0) {
      params.set("status", selectedStatuses.join(","));
    }
    if (!params.has("mine")) params.set("mine", mineOnly ? "1" : "0");
    params.set("f", "1");
    // 상세 창이 열린 채로 필터를 바꾸면 창이 남으므로 함께 닫는다.
    params.delete("project");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  function toggleStatus(status: string) {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    return hrefWith({ status: next.length ? next.join(",") : null });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {STATUSES.map((status) => (
        <Link
          key={status}
          href={toggleStatus(status)}
          scroll={false}
          className={chipClass(selectedStatuses.includes(status))}
        >
          {STATUS_LABEL[status]}
        </Link>
      ))}
      <span aria-hidden className="mx-1 h-4 w-px bg-foreground/10" />
      <Link href={hrefWith({ mine: mineOnly ? "0" : "1" })} scroll={false} className={chipClass(mineOnly)}>
        내 프로젝트
      </Link>
    </div>
  );
}
