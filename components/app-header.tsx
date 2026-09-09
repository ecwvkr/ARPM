import { AppLogoMenu } from "@/components/app-logo-menu";
import { NotificationBell } from "@/app/notification-bell";

// 모든 화면이 쓰는 상단 바. 예전에는 화면마다 헤더를 따로 짜서 알림 종의 위치와
// 곁에 붙는 버튼이 제각각이었다.
//
// 자리를 고정한다.
//   왼쪽  앱 아이콘(설정·로그아웃 메뉴) + 제목
//   오른쪽 화면별 동작(children) + 알림 종
//
// 만들기 버튼(새 파트너·새 프로젝트)은 여기 두지 않는다 — 만들 대상이 놓인 목록
// 바로 위에 있어야 무엇이 만들어지는지 헷갈리지 않는다.
export function AppHeader({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 오른쪽 알림 종 왼편에 놓을 화면별 버튼 */
  children?: React.ReactNode;
}) {
  return (
    <header className="px-6 py-4 shadow-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppLogoMenu />
          <div className="min-w-0">
            <h1 className="min-w-0 text-base font-bold">{title}</h1>
            {subtitle}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {children}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
