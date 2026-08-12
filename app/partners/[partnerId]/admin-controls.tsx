"use client";

import { restorePartner } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";

// 보관된 파트너를 보고 있는 owner/총관리자에게만 렌더링된다(page.tsx). 숨김은 개인 설정으로
// 옮겨갔고(D2, 카드 ⋮ 메뉴), 보관은 여기의 복구 또는 설정 > 보관함에서 되돌린다(D3).
export function AdminControls({ partnerId }: { partnerId: string }) {
  return (
    <form action={restorePartner.bind(null, partnerId)}>
      <Button type="submit" size="sm" variant="outline">
        복구
      </Button>
    </form>
  );
}
