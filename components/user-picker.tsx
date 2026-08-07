"use client";

import { useEffect, useState } from "react";
import { listAllUsers } from "@/app/actions/users";

export function UserPicker({
  excludeIds,
  selected,
  onChange,
  label = "초대할 계정",
}: {
  excludeIds: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    listAllUsers().then(setUsers);
  }, []);

  if (!users) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;

  const candidates = users.filter((u) => !excludeIds.includes(u.id));
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">초대할 수 있는 계정이 없습니다.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((u) => {
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
    </div>
  );
}
