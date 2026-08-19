"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { inviteMember } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/user-picker";
import { showToast } from "@/components/ui/global-toast";

export function InviteForm({ partnerId, excludeIds }: { partnerId: string; excludeIds: string[] }) {
  const action = inviteMember.bind(null, partnerId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setSelected([]);
      showToast("초대되었습니다");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <form
      action={(formData) => {
        selected.forEach((userId) => formData.append("userIds", userId));
        submitted.current = true;
        return formAction(formData);
      }}
      className="space-y-2"
    >
      <UserPicker
        excludeIds={excludeIds}
        selected={selected}
        onChange={setSelected}
        label="멤버초대"
        emptyMessage="초대할 멤버가 없습니다."
      />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" disabled={isPending || selected.length === 0}>
        초대
      </Button>
    </form>
  );
}
