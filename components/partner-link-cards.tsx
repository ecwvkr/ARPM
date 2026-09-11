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

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 링크가 없습니다.</p>
      ) : (
        // 바로가기는 훑고 지나가는 것이라 자리를 적게 차지해야 한다. 이름만 보여 주고
        // 주소는 뺀다 — 어디로 가는지는 이름이 말해 주고, 주소는 수정 창에서 본다.
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="relative rounded-3xl bg-card px-3 py-2.5 shadow-sm ring-1 ring-foreground/5 transition-shadow hover:shadow-md dark:ring-foreground/10"
            >
              {/* 카드 전체를 덮는 링크. 새 탭으로 열되 noopener로 원래 창을 넘겨주지 않는다. */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-0 rounded-3xl"
                aria-label={`${link.title} 열기`}
              />
              <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-1.5">
                <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.title}</span>
                {canManage && (
                  <span className="pointer-events-auto flex shrink-0 items-center">
                    <PartnerLinkFormDialog partnerId={partnerId} link={link} />
                    <PartnerLinkDeleteButton linkId={link.id} title={link.title} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
