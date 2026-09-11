// 화면마다 "기억할 주소 조각"을 정해 둔다. 전부 기억하면 검색어나 보고 있던 날짜까지
// 되살아나서, 새로 들어왔는데 지난번 검색 결과가 떠 있는 꼴이 된다.
//
// lib/view-prefs.ts에 두면 안 된다 — 거기는 prisma를 들여오므로, 클라이언트 컴포넌트가
// 이 목록을 가져오는 순간 Postgres 드라이버까지 브라우저 번들에 끌려온다(실제로
// "Can't resolve 'dns'" 빌드 오류가 났다). 값만 있는 이 파일은 어느 쪽에서 가져와도 안전하다.
export const REMEMBERED_PARAMS: Record<string, string[]> = {
  projects: ["view"],
  tasks: ["view"],
  comments: ["filter", "layout"],
  // 캘린더는 월간/일간과 완료 숨김만. 날짜(d)는 매번 오늘부터 시작해야 한다.
  calendar: ["v", "done"],
};

export type ViewSection = keyof typeof REMEMBERED_PARAMS;

// 지금 주소에서 기억할 것만 골라 "a=1&b=2" 꼴로 만든다. 저장할 값이 없으면 빈 문자열.
// 저장하는 쪽(화면)과 읽는 쪽(서버)이 같은 규칙을 써야 하므로 여기 하나만 둔다.
export function pickRemembered(section: string, get: (key: string) => string | null): string {
  const picked = new URLSearchParams();
  for (const key of REMEMBERED_PARAMS[section] ?? []) {
    const value = get(key);
    if (value) picked.set(key, value);
  }
  return picked.toString();
}
