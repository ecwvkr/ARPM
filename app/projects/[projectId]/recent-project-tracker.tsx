"use client";

import { useEffect } from "react";
import { setRecentProject } from "@/lib/recent-project";

// 하단 GNB의 "업무" 탭 명칭을 마지막으로 본 프로젝트로 동적 표시하기 위한 기록용. 화면에 아무것도 그리지 않는다.
export function RecentProjectTracker({ id, name }: { id: string; name: string }) {
  useEffect(() => {
    setRecentProject(id, name);
  }, [id, name]);

  return null;
}
