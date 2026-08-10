"use client";

import { useState, useTransition } from "react";
import { toggleUserSuperAdmin, toggleUserActive } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditUserDialog } from "./edit-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

type AdminUser = { id: string; name: string; email: string; isSuperAdmin: boolean; isActive: boolean };

export function UserManagement({ users }: { users: AdminUser[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-1.5">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 p-3 text-sm"
          >
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                {u.name}
                {u.isSuperAdmin && <Badge variant="secondary">총관리자</Badge>}
                {!u.isActive && <Badge variant="destructive">비활성</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <EditUserDialog userId={u.id} name={u.name} email={u.email} />
              <ResetPasswordDialog userId={u.id} />
              <Button
                size="xs"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => toggleUserSuperAdmin(u.id))}
              >
                {u.isSuperAdmin ? "총관리자 해제" : "총관리자 부여"}
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => toggleUserActive(u.id))}
              >
                {u.isActive ? "비활성화" : "활성화"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
