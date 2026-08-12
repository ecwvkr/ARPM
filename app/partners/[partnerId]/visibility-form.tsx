"use client";

import { updatePartnerVisibility } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";

export function VisibilityForm({
  partnerId,
  visibility,
}: {
  partnerId: string;
  visibility: "PUBLIC" | "PRIVATE";
}) {
  const action = updatePartnerVisibility.bind(null, partnerId);

  return (
    <form action={action} className="flex items-center gap-2">
      <select
        name="visibility"
        aria-label="공개 범위"
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
