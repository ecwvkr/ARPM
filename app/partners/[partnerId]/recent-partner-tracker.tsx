"use client";

import { useEffect } from "react";
import { setRecentPartner } from "@/lib/recent-partner";

// 하단 GNB의 "프로젝트" 탭 명칭을 마지막으로 본 파트너로 동적 표시하기 위한 기록용. 화면에 아무것도 그리지 않는다.
export function RecentPartnerTracker({ id, name }: { id: string; name: string }) {
  useEffect(() => {
    setRecentPartner(id, name);
  }, [id, name]);

  return null;
}
