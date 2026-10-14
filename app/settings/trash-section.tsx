"use client";

import { useState, useTransition } from "react";
import { restorePartner, hardDeletePartner } from "@/app/actions/partners";
import { restoreProject, hardDeleteProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TRASH_RETENTION_DAYS, trashDaysLeft } from "@/lib/trash";

type TrashedPartner = { id: string; name: string; color: string | null; deletedAt: Date | null };
type TrashedProject = {
  id: string;
  title: string;
  deletedAt: Date | null;
  partner: { id: string; name: string; color: string | null };
};

// 영구 삭제는 되돌릴 수 없으므로(D3) '영구삭제' 타이핑 확인을 한 번 더 요구한다.
function HardDeleteRow({ onConfirm }: { onConfirm: (formData: FormData) => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
        영구 삭제
      </Button>
    );
  }

  return (
    <form
      action={(formData) => startTransition(() => onConfirm(formData))}
      className="flex items-center gap-1.5"
    >
      <Input name="confirm" placeholder="영구삭제" className="h-8 w-28 text-xs" required />
      <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
        확인
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
        취소
      </Button>
    </form>
  );
}

function TrashRow({
  color,
  title,
  subtitle,
  deletedAt,
  now,
  onRestore,
  onHardDelete,
}: {
  color: string | null;
  title: string;
  subtitle?: string;
  deletedAt: Date | null;
  now: number;
  onRestore: () => void;
  onHardDelete: (formData: FormData) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {subtitle && `${subtitle} · `}
            {deletedAt && new Date(deletedAt).toLocaleDateString("ko-KR")} 보관
            {deletedAt && <DaysLeft deletedAt={new Date(deletedAt)} now={now} />}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(onRestore)}
        >
          복구
        </Button>
        <HardDeleteRow onConfirm={onHardDelete} />
      </div>
    </li>
  );
}

// 크론이 영구 삭제하는 날까지 남은 날짜. 규칙은 크론과 같은 lib/trash.ts를 쓴다 —
// 화면의 날짜와 실제로 지워지는 날이 어긋나면 안 된다. 일주일 안으로 들어오면 붉게 둔다.
function DaysLeft({ deletedAt, now }: { deletedAt: Date; now: number }) {
  const days = trashDaysLeft(deletedAt, now);
  return (
    <span className={days <= 7 ? "text-destructive" : undefined}>
      {" · "}
      {days === 0 ? "오늘 자동 삭제" : `${days}일 후 자동 삭제`}
    </span>
  );
}

export function TrashSection({
  partners,
  projects,
  now,
}: {
  partners: TrashedPartner[];
  projects: TrashedProject[];
  /** 남은 날짜를 셀 기준 시각(서버에서 정해 넘긴다) */
  now: number;
}) {
  if (partners.length === 0 && projects.length === 0) {
    return <p className="text-sm text-muted-foreground">보관함이 비어 있습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        보관한 지 {TRASH_RETENTION_DAYS}일이 지나면 매일 오전 11시에 자동으로 영구 삭제됩니다. 필요한 것은 그 전에 복구하세요.
      </p>
      {partners.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">보관된 파트너 ({partners.length})</h3>
          <ul className="space-y-1.5">
            {partners.map((p) => (
              <TrashRow
                key={p.id}
                color={p.color}
                title={p.name}
                deletedAt={p.deletedAt}
                now={now}
                onRestore={() => restorePartner(p.id)}
                onHardDelete={(formData) => hardDeletePartner(p.id, undefined, formData)}
              />
            ))}
          </ul>
        </div>
      )}
      {projects.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">보관된 프로젝트 ({projects.length})</h3>
          <ul className="space-y-1.5">
            {projects.map((t) => (
              <TrashRow
                key={t.id}
                color={t.partner.color}
                title={t.title}
                subtitle={t.partner.name}
                deletedAt={t.deletedAt}
                now={now}
                onRestore={() => restoreProject(t.id)}
                onHardDelete={(formData) => hardDeleteProject(t.id, undefined, formData)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
