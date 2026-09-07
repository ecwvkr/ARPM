import type { PartnerLinkItem } from "@/lib/partner-links";
import { PartnerLinkFormDialog, PartnerLinkDeleteButton } from "@/components/partner-link-form-dialog";
import { IconExternalLink } from "@tabler/icons-react";

// 파트너 공지 아래에 두는 바로가기 카드. 자주 쓰는 문서·시트로 한 번에 넘어간다.
// 카드 전체가 링크라, 수정·삭제 버튼은 그 위에 따로 얹는다(카드 링크로 클릭이
// 새어 들어가지 않도록 버튼 쪽만 클릭을 받는다 — 프로젝트 카드와 같은 방식).
export function PartnerLinkCards({
  partnerId,
  links,
  canManage,
}: {
  partnerId: string;
  links: PartnerLinkItem[];
  canManage: boolean;
}) {
  // 링크도 없고 추가할 수도 없는 사람에게는 빈 자리를 만들지 않는다.
  if (links.length === 0 && !canManage) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">바로가기</h2>
        {canManage && <PartnerLinkFormDialog partnerId={partnerId} />}
      </div>

      {/* 좁은 화면에서는 한 줄에 하나씩 둔다. 두 칸으로 나누면 카드 폭이 140px 남짓이라
          제목이 두세 글자만 남고 잘린다(수정·삭제 버튼 자리도 빼야 한다). */}
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 링크가 없습니다.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="relative rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10"
            >
              {/* 카드 전체를 덮는 링크. 새 탭으로 열되 noopener로 원래 창을 넘겨주지 않는다. */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-0 rounded-4xl"
                aria-label={`${link.title} 열기`}
              />
              {/* 수정·삭제는 카드 모서리에 얹는다. 제목과 같은 줄에 두면 좁은 화면에서
                  제목이 두세 글자만 남고 잘린다. */}
              {canManage && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
                  <PartnerLinkFormDialog partnerId={partnerId} link={link} />
                  <PartnerLinkDeleteButton linkId={link.id} title={link.title} />
                </div>
              )}
              <div className="pointer-events-none relative z-10 min-w-0 space-y-1">
                <p className={`flex items-start gap-1 text-sm font-bold ${canManage ? "pr-12" : ""}`}>
                  <IconExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  {/* 긴 제목이 카드를 밀고 나가지 않게 두 줄까지만 둔다. */}
                  <span className="line-clamp-2 break-keep [overflow-wrap:anywhere]">{link.title}</span>
                </p>
                {/* 어디로 가는지 보이게 주소도 한 줄 보여 준다. */}
                <p className="truncate text-xs text-muted-foreground">{hostOf(link.url)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// 주소를 통째로 보여주면 카드가 주소로 가득 차므로 도메인만 보여 준다.
function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
