// 설정은 한 화면에 다 쌓지 않고 목록 → 상세로 들어가는 스택 구조다.
// 이 목록이 /settings의 메뉴와 /settings/[section]의 유효 slug를 동시에 정한다.
export const SETTINGS_SECTIONS = [
  {
    slug: "account",
    title: "내 계정",
    description: "이름과 비밀번호를 변경합니다.",
    adminOnly: false,
  },
  {
    slug: "appearance",
    title: "포인트 컬러",
    description: "앱 전체에서 강조색으로 쓰이는 색상입니다.",
    adminOnly: false,
  },
  {
    slug: "trash",
    title: "보관함",
    description: "보관된 파트너·프로젝트를 복구하거나 영구 삭제합니다.",
    adminOnly: false,
  },
  {
    slug: "new-account",
    title: "계정 발급",
    description: "새 팀원 계정을 직접 발급합니다.",
    adminOnly: true,
  },
  {
    slug: "users",
    title: "사용자 관리",
    description: "팀원 정보 수정·권한 부여·계정 활성화를 관리합니다.",
    adminOnly: true,
  },
  {
    slug: "app",
    title: "글로벌 설정",
    description: "코멘트 기본 노출 개수 등 앱 전체 설정입니다.",
    adminOnly: true,
  },
] as const;

export type SettingsSectionSlug = (typeof SETTINGS_SECTIONS)[number]["slug"];
