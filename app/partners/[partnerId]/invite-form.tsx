"use client";

import { useActionState, useState } from "react";
import { inviteMember } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/user-picker";

export function InviteForm({ partnerId, excludeIds }: { partnerId: string; excludeIds: string[] }) {
  const action = inviteMember.bind(null, partnerId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <form
      action={(formData) => {
        selected.forEach((userId) => formData.append("userIds", userId));
        return formAction(formData);
      }}
      className="space-y-2"
    >
      <UserPicker excludeIds={excludeIds} selected={selected} onChange={setSelected} label="초대할 멤버" />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" disabled={isPending || selected.length === 0}>
        초대
      </Button>
    </form>
  );
}
