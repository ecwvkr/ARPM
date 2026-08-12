const KEY = "ar_pm_recent_partner";
const CHANGE_EVENT = "ar-pm-recent-partner-change";

// useSyncExternalStore의 getSnapshot은 값이 그대로면 매번 같은 참조를 반환해야 하므로
// (아니면 불필요한 재렌더가 계속 발생) 원본 문자열이 바뀌었을 때만 새로 파싱한다.
let cachedRaw: string | null = null;
let cachedValue: { id: string; name: string } | null = null;

export function getRecentPartner(): { id: string; name: string } | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? JSON.parse(raw) : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function setRecentPartner(id: string, name: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, name }));
    // localStorage의 'storage' 이벤트는 다른 탭에서만 발생하므로, 같은 탭에서
    // useSyncExternalStore가 즉시 재구독하도록 커스텀 이벤트를 함께 쏜다.
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ponytail: localStorage 접근 불가(프라이빗 모드 등)는 무시 — 이 기능은 선택적 편의 기능
  }
}

export function subscribeRecentPartner(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
