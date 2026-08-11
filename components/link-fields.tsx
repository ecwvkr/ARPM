"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconPlus, IconX } from "@tabler/icons-react";

// 링크 입력 여러 칸. 모두 name="link"로 내보내고 서버에서 formData.getAll("link")로 받는다.
// 빈 칸은 서버에서 버려지므로 굳이 여기서 거르지 않는다.
export function LinkFields({ defaultLinks = [] }: { defaultLinks?: string[] }) {
  const [links, setLinks] = useState<string[]>(defaultLinks.length > 0 ? defaultLinks : [""]);

  return (
    <div className="space-y-1.5">
      {links.map((value, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            name="link"
            value={value}
            placeholder="https://example.com"
            aria-label={`링크 ${i + 1}`}
            onChange={(e) =>
              setLinks((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
            }
          />
          {links.length > 1 && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="이 링크 삭제"
              aria-label={`링크 ${i + 1} 삭제`}
              onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
            >
              <IconX />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setLinks((prev) => [...prev, ""])}
      >
        <IconPlus className="size-4" />
        링크 추가
      </Button>
    </div>
  );
}
