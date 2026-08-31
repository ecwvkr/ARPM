"use client";

import { useEffect } from "react";

// 앱을 열 때 서비스 워커를 등록해 둔다.
//
//  · 설치형 앱(PWA)으로 인정받으려면 워커가 등록돼 있어야 한다 — 안 그러면 크롬의
//    '앱 설치' 버튼이 아예 안 뜬다.
//  · 알림 설정 화면에 들어가지 않아도 푸시를 받을 준비가 끝난다. 예전에는 설정에서
//    '알림 받기'를 누를 때만 등록해서, 그 화면을 안 거치면 워커가 없었다.
//
// 등록은 브라우저가 알아서 중복을 걸러 주므로 매번 불러도 된다. 실패해도 앱 동작에는
// 영향이 없으므로 조용히 넘어간다(로컬 http, 지원 안 하는 브라우저 등).
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
