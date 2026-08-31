import type { NoticeItem } from "@/lib/notices";
import { NoticeFormDialog, NoticeDeleteButton } from "@/components/notice-form-dialog";

// 서버 컴포넌트로 둔다 — 시각을 서버에서 한 번만 찍어야 하이드레이션 때 서버(UTC)와
// 브라우저(KST)의 표기가 어긋나지 않는다. 눌러야 동작하는 부분만 클라이언트다.
const TIME_ZONE = "Asia/Seoul";

function stamp(date: Date) {
  return new Date(date).toLocaleString("ko-KR", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function day(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR", { timeZone: TIME_ZONE });
}

const CARD =
  "rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10";

// 대시보드의 전체공지와 파트너 탭의 파트너 공지가 같은 컴포넌트를 쓴다.
// partnerId가 있으면 파트너 공지, 없으면 전체공지다(lib/notices.ts의 권한 규칙과 짝).
export function NoticeSection({
  heading,
  partnerId,
  notices,
  canManage,
}: {
  heading: string;
  partnerId?: string;
  notices: NoticeItem[];
  canManage: boolean;
}) {
  const [latest, ...older] = notices;

  // 공지도 없고 쓸 수도 없는 사람에게는 빈 섹션을 띄우지 않는다 — 대시보드·파트너 탭
  // 상단에 "등록된 공지가 없습니다."만 계속 남는다.
  if (notices.length === 0 && !canManage) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">{heading}</h2>
        {canManage && <NoticeFormDialog partnerId={partnerId} />}
      </div>

      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 공지가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {/* 가장 최근 1건만 펼쳐 둔다. */}
          <NoticeCard notice={latest} canManage={canManage} defaultOpen />

          {older.length > 0 && (
            <details className={CARD}>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                이전 공지 {older.length}건
              </summary>
              <div className="mt-2 divide-y divide-foreground/10">
                {older.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} canManage={canManage} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

// 공지 한 건. 접혀 있을 때는 제목과 날짜만, 펼치면 본문과 작성·수정 로그가 보인다.
function NoticeCard({
  notice,
  canManage,
  defaultOpen = false,
}: {
  notice: NoticeItem;
  canManage: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className={defaultOpen ? CARD : "py-2"}>
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        {/* flex 자식은 기본 min-width:auto라 min-w-0이 있어야 긴 제목이 실제로 잘린다. */}
        <span className="min-w-0 flex-1 truncate">{notice.title}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          {day(notice.createdAt)}
        </span>
      </summary>

      <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{notice.body}</p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          <span className="text-foreground">{notice.createdByName}</span> 작성 · {stamp(notice.createdAt)}
          {notice.updatedByName && (
            <>
              <br />
              <span className="text-foreground">{notice.updatedByName}</span> 수정 ·{" "}
              {stamp(notice.updatedAt)}
            </>
          )}
        </p>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <NoticeFormDialog notice={{ id: notice.id, title: notice.title, body: notice.body }} />
            <NoticeDeleteButton noticeId={notice.id} />
          </div>
        )}
      </div>
    </details>
  );
}
