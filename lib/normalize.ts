// 이메일/아이디는 대소문자·앞뒤 공백 차이로 로그인 실패가 나지 않도록 항상 이 형태로 저장·조회한다.
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

// 업무 참고 링크. 스킴을 빼고 적는 게 보통이라 https://를 붙여주되, 화면에
// 그대로 <a href>로 나가므로 http(s)가 아닌 스킴(javascript: 등)은 거부한다.
// 빈 값이면 null, 값이 있는데 URL이 아니면 undefined(=입력 오류)를 돌려준다.
export function normalizeLink(raw: string | null | undefined): string | null | undefined {
  const value = (raw ?? "").trim();
  if (!value) return null;

  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
