// 이메일/아이디는 대소문자·앞뒤 공백 차이로 로그인 실패가 나지 않도록 항상 이 형태로 저장·조회한다.
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}
