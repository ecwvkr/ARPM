"use client";

import { useActionState } from "react";
import { updateProjectColor } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

const DEFAULT_COLOR = "#2563eb";

export function ProjectColorForm({
  projectId,
  currentColor,
}: {
  projectId: string;
  currentColor: string | null;
}) {
  const action = updateProjectColor.bind(null, projectId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input
        type="color"
        name="color"
        defaultValue={currentColor ?? DEFAULT_COLOR}
        className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        저장
      </Button>
      {currentColor && (
        <Button type="submit" name="reset" value="1" size="sm" variant="outline" disabled={isPending}>
          색상 없음
        </Button>
      )}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
