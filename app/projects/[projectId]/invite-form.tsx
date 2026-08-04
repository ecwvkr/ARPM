"use client";

import { useActionState } from "react";
import { inviteMember } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteForm({ projectId }: { projectId: string }) {
  const action = inviteMember.bind(null, projectId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-start gap-2">
      <Input name="email" type="email" placeholder="이메일로 초대" required />
      <Button type="submit" size="sm" disabled={isPending}>
        초대
      </Button>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
