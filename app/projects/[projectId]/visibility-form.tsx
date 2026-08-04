"use client";

import { updateProjectVisibility } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

export function VisibilityForm({
  projectId,
  visibility,
}: {
  projectId: string;
  visibility: "PUBLIC" | "PRIVATE";
}) {
  const action = updateProjectVisibility.bind(null, projectId);

  return (
    <form action={action} className="flex items-center gap-2">
      <select
        name="visibility"
        defaultValue={visibility}
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
      >
        <option value="PRIVATE">비공개</option>
        <option value="PUBLIC">공개</option>
      </select>
      <Button type="submit" size="sm" variant="outline">
        저장
      </Button>
    </form>
  );
}
