import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// 최소 권한만 요청한다: openid/email은 연결된 계정 표시용, calendar.readonly는 기존 일정 조회,
// calendar.app.created는 앱이 만든 캘린더(보조 캘린더)에만 쓰기 — 전체 캘린더 쓰기 권한은 요청하지 않는다.
// calendar.app.created는 '앱이 만든 캘린더'에만 쓸 수 있어, 사용자가 원래 쓰던 캘린더
// (예: X-allrounder)에 일정을 추가하려면 calendar.events가 필요하다.
// 이 스코프를 추가한 뒤에는 기존 연결을 끊고 다시 연결해야 새 권한이 적용된다.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

// 콜백 주소는 인증 시작(connect)과 토큰 교환(callback) 양쪽에서 완전히 같아야 하고,
// 구글 콘솔에 등록한 값과도 정확히 일치해야 한다.
// origin은 요청 헤더에서 뽑는 걸 1순위로 둔다 — AUTH_URL을 배포 환경에 넣지 않아도
// 지금 접속한 도메인 그대로 만들어지기 때문이다(이걸 놓쳐서 redirect_uri=undefined/... 가 됐다).
// 프록시 뒤(Vercel 등)에서는 x-forwarded-* 가 실제 외부 주소를 담고 있다.
export function originFromRequest(request: Request): string | null {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function googleRedirectUri(origin?: string | null) {
  const base =
    origin ??
    process.env.AUTH_URL ??
    // Vercel이 자동으로 넣어주는 '프로덕션 고정 도메인'. VERCEL_URL은 배포마다 바뀌어
    // 구글 콘솔 등록값과 어긋나므로 쓰지 않는다.
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);

  if (!base) throw new Error("콜백 주소를 만들 수 없습니다. AUTH_URL 환경변수를 설정해 주세요.");
  return `${base.replace(/\/$/, "")}/api/google/callback`;
}

export class GoogleAuthError extends Error {}

// GOOGLE_TOKEN_KEY(64자리 hex = 32바이트)로 AES-256-GCM 암호화. iv:authTag:ciphertext를 base64로 이어붙여 저장한다.
function tokenKey() {
  const hex = process.env.GOOGLE_TOKEN_KEY;
  if (!hex || hex.length !== 64) throw new Error("GOOGLE_TOKEN_KEY가 32바이트 hex 값으로 설정되어 있지 않습니다.");
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptToken(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(":");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]).toString("utf8");
}

export function buildGoogleAuthUrl(state: string, origin?: string | null) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline", // refresh_token을 받으려면 필요
    prompt: "consent", // 재연결 시에도 매번 refresh_token을 다시 받기 위해 강제로 동의 화면을 띄운다
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

// origin은 인증을 시작할 때 쓴 값과 반드시 같아야 한다(구글이 대조한다).
export async function exchangeCodeForTokens(code: string, origin?: string | null): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new GoogleAuthError(`토큰 교환 실패: ${await res.text()}`);
  return res.json();
}

// id_token(JWT)의 payload만 디코드해 이메일을 읽는다 — 서명 검증까지는 필요 없다(발급 직후 우리
// 서버가 구글 토큰 엔드포인트에서 직접 받은 값이라 위조 경로가 없다).
export function extractEmailFromIdToken(idToken: string): string {
  const payload = idToken.split(".")[1];
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json).email;
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // 리프레시 실패는 대개 토큰이 해지된 경우 — 재연결이 필요하다는 신호로 구분해서 던진다.
    throw new GoogleAuthError(`리프레시 토큰이 만료되었거나 해지되었습니다: ${await res.text()}`);
  }
  const data: TokenResponse = await res.json();
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

// 연결이 없으면 null, 있으면 유효한(필요 시 갱신된) access token을 돌려준다.
// 리프레시가 실패하면 GoogleAuthError를 던진다 — 호출부는 이를 "재연결 필요"로 취급한다.
export async function getValidAccessToken(): Promise<string | null> {
  const conn = await prisma.googleConnection.findFirst();
  if (!conn) return null;

  const EXPIRY_BUFFER_MS = 60_000;
  if (conn.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return decryptToken(conn.accessToken);
  }

  const { accessToken, expiresAt } = await refreshAccessToken(decryptToken(conn.refreshToken));
  await prisma.googleConnection.update({
    where: { id: conn.id },
    data: { accessToken: encryptToken(accessToken), expiresAt },
  });
  return accessToken;
}

export async function revokeGoogleToken(refreshToken: string) {
  // 실패해도(이미 해지됐거나 네트워크 오류) 로컬 연결 삭제는 계속 진행 — 구글 쪽 실패가 "연결 해제"를 막으면 안 된다.
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: "POST" }).catch(() => {});
}
