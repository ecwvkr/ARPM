import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildGoogleAuthUrl, originFromRequest } from "@/lib/google/client";

const STATE_COOKIE = "google_oauth_state";

// 총관리자만 회사 공용 구글 계정을 연결할 수 있다.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) redirect("/settings");

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 동의 화면에서 머무를 수 있는 여유 시간
    path: "/",
  });

  // 지금 접속한 도메인 그대로 콜백을 만든다 — 배포 환경에 AUTH_URL이 없어도 동작한다.
  redirect(buildGoogleAuthUrl(state, originFromRequest(request)));
}
