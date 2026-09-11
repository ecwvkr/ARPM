import { prisma } from "@/lib/prisma";
import { REMEMBERED_PARAMS, type ViewSection } from "@/lib/view-prefs-config";

// 탭을 다시 열면 지난번에 보던 모습 그대로 나오게 한다. 들어갈 때마다 뷰를 다시
// 고르는 것이 잦은 불편이었다.
//
// 저장된 설정을 읽어 URLSearchParams로 돌려준다. 없으면 빈 것.
export async function readViewPref(userId: string, section: ViewSection): Promise<URLSearchParams> {
  const row = await prisma.viewPreference.findUnique({
    where: { userId_key: { userId, key: section } },
    select: { value: true },
  });
  return new URLSearchParams(row?.value ?? "");
}

// 화면이 받은 검색 파라미터에 저장된 설정을 얹는다. 주소에 직접 적힌 값이 우선이다 —
// 링크를 타고 들어온 사람이 엉뚱한 뷰를 보면 안 된다.
export async function withRememberedView(
  userId: string,
  section: ViewSection,
  params: Record<string, string | string[] | undefined>,
): Promise<Record<string, string | string[] | undefined>> {
  const keys = REMEMBERED_PARAMS[section] ?? [];
  // 하나라도 주소에 적혀 있으면 그 사람이 방금 고른 것이므로 저장값을 섞지 않는다.
  if (keys.some((k) => typeof params[k] === "string")) return params;

  const saved = await readViewPref(userId, section);
  if ([...saved.keys()].length === 0) return params;

  const merged = { ...params };
  for (const key of keys) {
    const value = saved.get(key);
    if (value) merged[key] = value;
  }
  return merged;
}
