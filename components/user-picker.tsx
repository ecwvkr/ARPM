"use client";

import { useEffect, useState } from "react";
import { listAllUsers } from "@/app/actions/users";
import { Input } from "@/components/ui/input";

// 팀원이 늘어나면 칩을 전부 나열하는 방식은 못 쓰므로(P5), 후보가 이 수를
// 넘으면 이름 검색 입력을 함께 보여준다. 소수 팀에서는 검색창이 오히려
// 빈 UI라 후보가 적을 땐 숨긴다.
const SEARCH_THRESHOLD = 6;

export function UserPicker({
  excludeIds,
  selected,
  onChange,
  label = "초대할 계정",
  emptyMessage = "초대할 수 있는 계정이 없습니다.",
}: {
  excludeIds: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  emptyMessage?: string;
}) {
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listAllUsers().then(setUsers);
  }, []);

  if (!users) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;

  const candidates = users.filter((u) => !excludeIds.includes(u.id));
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const filtered = query.trim()
    ? candidates.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()))
    : candidates;

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      {candidates.length > SEARCH_THRESHOLD && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색"
          aria-label={`${label} 검색`}
          className="h-8 text-sm"
        />
      )}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((u) => {
            const active = selected.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(active ? selected.filter((id) => id !== u.id) : [...selected, u.id])
                }
                className={
                  active
                    ? "rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground"
                    : "rounded-full bg-muted px-2.5 py-1 text-xs"
                }
              >
                {u.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
