"use client";

import { useActionState } from "react";
import { updateAccentColor } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";

const DEFAULT_COLOR = "#2563eb";

export function AccentColorForm({ currentColor }: { currentColor: string | null }) {
  const [errorMessage, formAction, isPending] = useActionState(updateAccentColor, undefined);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input
        type="color"
        name="accentColor"
        defaultValue={currentColor ?? DEFAULT_COLOR}
        className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        저장
      </Button>
      {currentColor && (
        <Button type="submit" name="reset" value="1" size="sm" variant="outline" disabled={isPending}>
          기본값으로
        </Button>
      )}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
