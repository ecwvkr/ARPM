import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  // api/cron은 로그인 세션 없이 Vercel 크론이 부르므로 여기서 빼고, 그 라우트가
  // CRON_SECRET을 직접 확인한다(app/api/cron/deadlines/route.ts).
  matcher: ["/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
