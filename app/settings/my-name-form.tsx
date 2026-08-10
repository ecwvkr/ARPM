"use client";

import { useActionState } from "react";
import { updateMyName } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MyNameForm({ name }: { name: string }) {
  const [errorMessage, formAction, isPending] = useActionState(updateMyName, undefined);

  return (
    <form action={formAction} className="max-w-sm space-y-1.5">
      <div className="flex items-center gap-2">
        <Input key={name} name="name" defaultValue={name} required className="h-9" />
        <Button type="submit" size="sm" disabled={isPending}>
          저장
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
