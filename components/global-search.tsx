"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconBuilding, IconFileText, IconSquareCheck, IconMessage } from "@tabler/icons-react";
import { searchEverything, type SearchHit } from "@/app/actions/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  partner: "파트너",
  project: "프로젝트",
  task: "태스크",
  comment: "코멘트",
};
const KIND_ICON: Record<SearchHit["kind"], React.ComponentType<{ className?: string }>> = {
  partner: IconBuilding,
  project: IconFileText,
  task: IconSquareCheck,
  comment: IconMessage,
};

// 상단 바의 전체 검색. 돋보기를 누르거나 어디서든 Ctrl+K(맥은 Cmd+K)로 연다.
// 검색창이 전체 프로젝트·태스크 화면에 따로 있어서, 무엇을 찾으려면 먼저 어느 화면에
// 있는지 알아야 했다. 여기서는 파트너·프로젝트·태스크·코멘트를 한 번에 찾는다.
//
// 타이핑을 멈추고 0.25초 뒤에 한 번 묻는다 — 글자마다 서버를 부르지 않는다.
// ↑↓로 고르고 Enter로 간다. 프로젝트·태스크·코멘트는 그 프로젝트 상세 창으로 연다.
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // 어느 검색어의 결과인지 함께 들고 있는다. 지금 입력과 다르면 "찾는 중"으로 본다 —
  // effect 안에서 결과를 비우면(동기 setState) 렌더가 연쇄로 돈다.
  const [result, setResult] = useState<{ q: string; hits: SearchHit[] } | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim();
  const hits = result?.q === q ? result.hits : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); // 브라우저 주소창 검색으로 가지 않게
      setOpen((o) => !o);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchEverything(q)
        .then((list) => {
          if (!cancelled) {
            setResult({ q, hits: list });
            setActive(0);
          }
        })
        .catch(() => {
          if (!cancelled) setResult({ q, hits: [] });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  // 고른 줄이 목록 밖으로 나가면 따라 내려간다.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!hits?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      // 한글 조합 중의 Enter는 글자를 확정하는 것이지 이동하라는 뜻이 아니다.
      e.preventDefault();
      go(hits[active]);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="검색 (Ctrl+K)"
        title="검색 (Ctrl+K)"
        onClick={() => setOpen(true)}
      >
        <IconSearch className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] translate-y-0 gap-3 sm:max-w-lg" showCloseButton={false}>
          <DialogTitle className="sr-only">전체 검색</DialogTitle>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="파트너·프로젝트·태스크·코멘트 검색"
              aria-label="전체 검색"
              className="pl-9"
            />
          </div>

          {!q ? (
            <p className="px-1 text-xs text-muted-foreground">
              이름, 담당자, 태스크 내용, 코멘트 내용으로 찾습니다. ↑↓로 고르고 Enter로 이동합니다.
            </p>
          ) : hits === null ? (
            <p className="px-1 text-xs text-muted-foreground">찾는 중...</p>
          ) : hits.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">&ldquo;{q}&rdquo;에 맞는 결과가 없습니다.</p>
          ) : (
            <ul ref={listRef} role="listbox" aria-label="검색 결과" className="-mx-2 space-y-0.5">
              {hits.map((hit, i) => {
                const Icon = KIND_ICON[hit.kind];
                // 종류가 바뀌는 첫 줄에만 묶음 이름을 단다.
                const firstOfKind = i === 0 || hits[i - 1].kind !== hit.kind;
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    {firstOfKind && (
                      <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{KIND_LABEL[hit.kind]}</p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(hit)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left ${
                        i === active ? "bg-muted" : ""
                      } ${hit.done ? "opacity-55" : ""}`}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${hit.kind === "task" && hit.done ? "line-through" : ""}`}>
                          {hit.title}
                        </span>
                        {hit.kind !== "partner" && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {hit.color && (
                              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: hit.color }} />
                            )}
                            <span className="truncate">{hit.context}</span>
                          </span>
                        )}
                      </span>
                      {hit.kind === "partner" && hit.color && (
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hit.color }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
