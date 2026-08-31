import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  // 빼는 것들:
  //  · api/cron  — 로그인 세션 없이 Vercel 크론이 부른다. 그 라우트가 CRON_SECRET을
  //    직접 확인한다(app/api/cron/deadlines/route.ts).
  //  · 매니페스트·서비스워커·앱 아이콘 — 설치형 앱(PWA) 자산이다. 특히 매니페스트는
  //    브라우저가 인증정보 없이 받아 가므로, 막아 두면 로그인 화면으로 튕겨 앱 설치가
  //    아예 안 된다. 셋 다 비밀이 아니고 로그인 화면에서도 보여야 한다.
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|icon-192.png|icon-512.png|apple-icon.png).*)",
  ],
};
