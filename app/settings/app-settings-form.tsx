"use client";

import { useActionState } from "react";
import { updateCommentVisibleCount } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppSettingsForm({ commentVisibleCount }: { commentVisibleCount: number }) {
  const [errorMessage, formAction, isPending] = useActionState(updateCommentVisibleCount, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input
        key={commentVisibleCount}
        name="commentVisibleCount"
        type="number"
        min={1}
        defaultValue={commentVisibleCount}
        className="w-24"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        저장
      </Button>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
