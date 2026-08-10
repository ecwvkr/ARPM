"use client";

import { useActionState } from "react";
import { updateProjectName } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProjectNameForm({ projectId, name }: { projectId: string; name: string }) {
  const action = updateProjectName.bind(null, projectId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input key={name} name="name" defaultValue={name} required className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          저장
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
