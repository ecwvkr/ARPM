"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { saveViewPref } from "@/app/actions/view-prefs";
import { pickRemembered } from "@/lib/view-prefs-config";

// 이 화면에서 고른 보기 설정을 계정에 저장해 둔다. 다음에 탭을 열면 서버가 그 설정을
// 되살려 준다(lib/view-prefs.ts의 withRememberedView).
//
// 화면 어디에나 한 번 두면 되고 아무것도 그리지 않는다. 주소가 바뀔 때만 저장하므로
// 뷰를 바꾸지 않고 돌아다니는 동안에는 호출이 나가지 않는다.
export function RememberView({ section }: { section: string }) {
  const searchParams = useSearchParams();

  // 기억할 값만 뽑아 문자열로 만든다. 이게 그대로 저장되는 값이다.
  const value = pickRemembered(section, (key) => searchParams.get(key));

  // 같은 값을 다시 저장하지 않는다 — 화면이 다시 그려질 때마다 서버를 부르면
  // 무료 플랜에서 호출 수만 늘어난다.
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    if (!value || lastSaved.current === value) return;
    lastSaved.current = value;
    saveViewPref(section, value).catch(() => {
      // 저장이 실패해도 화면은 그대로다. 다음 진입 때 지난 설정이 안 뜰 뿐이다.
    });
  }, [section, value]);

  return null;
}
