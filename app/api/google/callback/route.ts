import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, extractEmailFromIdToken, encryptToken } from "@/lib/google/client";
import { createSyncCalendar } from "@/lib/google/calendar";

const STATE_COOKIE = "google_oauth_state";
const SETTINGS_PATH = "/settings/google";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) redirect("/settings");

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  // redirect()는 던지는 방식으로 동작해 try/catch 안에서 부르면 그 catch에 먹힌다.
  // 그래서 실패 사유만 이 변수에 모아두고, redirect 호출은 맨 끝에서 try/catch 밖에서 한다.
  let errorReason: string | null = oauthError ?? (!code || !state || state !== expectedState ? "invalid_state" : null);

  if (!errorReason) {
    try {
      const tokens = await exchangeCodeForTokens(code!);
      if (!tokens.refresh_token) {
        // prompt=consent를 항상 붙이므로 보통 여기 오지 않지만, 혹시 비어 있으면 재연결을 안내한다.
        errorReason = "no_refresh_token";
      } else {
        const googleEmail = tokens.id_token ? extractEmailFromIdToken(tokens.id_token) : "알 수 없음";
        const syncCalendarId = await createSyncCalendar(tokens.access_token);

        // 공용 계정 1개만 유지 — 재연결이면 기존 행을 지우고 새로 만든다.
        await prisma.googleConnection.deleteMany({});
        await prisma.googleConnection.create({
          data: {
            googleEmail,
            accessToken: encryptToken(tokens.access_token),
            refreshToken: encryptToken(tokens.refresh_token),
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            scope: tokens.scope,
            syncCalendarId,
            connectedById: session.user.id,
          },
        });
      }
    } catch (e) {
      errorReason = e instanceof Error ? e.message : "unknown_error";
    }
  }

  redirect(errorReason ? `${SETTINGS_PATH}?error=${encodeURIComponent(errorReason)}` : `${SETTINGS_PATH}?connected=1`);
}
