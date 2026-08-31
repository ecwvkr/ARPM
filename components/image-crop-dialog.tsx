"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clampOffset, coverScale, sourceRect, type Offset, type Size } from "@/lib/crop";

// 화면에 보여 주는 정사각 틀의 한 변(px). 모바일 최소 폭에서도 다이얼로그 안에 들어간다.
const VIEWPORT = 256;
const MAX_ZOOM = 3;

// 프로필 사진을 1:1로 잘라내는 창. 끌어서 위치를 잡고 슬라이더로 확대한다.
// 원형 가이드 안쪽이 실제로 아바타에 보이는 부분이다 — 아바타가 원형이라 네모로만
// 보여 주면 가장자리가 어디까지 잘리는지 알 수 없다.
//
// 열려 있을 때만 마운트되는 것을 전제로 한다(호출부에서 조건부 렌더).
export function ImageCropDialog({
  file,
  size,
  onCancel,
  onCropped,
}: {
  file: File;
  /** 저장할 정사각형 한 변(px) */
  size: number;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}) {
  const [image, setImage] = useState<{ el: HTMLImageElement; natural: Size } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dragStart = useRef<{ pointer: Offset; offset: Offset } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setUrl(objectUrl);
      setImage({ el, natural: { width: el.naturalWidth, height: el.naturalHeight } });
    };
    el.onerror = () => setErrorMessage("이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.");
    el.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // 틀을 덮는 최소 배율에 사용자가 고른 확대율을 곱한 것이 실제 배율이다.
  const scale = image ? coverScale(image.natural, VIEWPORT) * zoom : 1;

  function move(next: Offset) {
    if (!image) return;
    setOffset(clampOffset(next, image.natural, VIEWPORT, scale));
  }

  function changeZoom(nextZoom: number) {
    if (!image) return;
    setZoom(nextZoom);
    // 확대율을 줄이면 지금 위치가 한계를 벗어날 수 있으므로 다시 안으로 당겨 준다.
    const nextScale = coverScale(image.natural, VIEWPORT) * nextZoom;
    setOffset((prev) => clampOffset(prev, image.natural, VIEWPORT, nextScale));
  }

  function save() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setErrorMessage("이미지를 처리할 수 없습니다.");
      return;
    }
    const rect = sourceRect(image.natural, VIEWPORT, scale, offset);
    ctx.drawImage(image.el, rect.x, rect.y, rect.side, rect.side, 0, 0, size, size);
    onCropped(canvas.toDataURL("image/jpeg", 0.8));
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>사진 자르기</DialogTitle>
        </DialogHeader>

        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : (
          <div className="space-y-3">
            <div
              // touch-none이라야 모바일에서 끌 때 페이지가 같이 스크롤되지 않는다.
              className="relative mx-auto touch-none overflow-hidden rounded-2xl bg-black select-none"
              style={{ width: VIEWPORT, height: VIEWPORT }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragStart.current = { pointer: { x: e.clientX, y: e.clientY }, offset };
              }}
              onPointerMove={(e) => {
                const start = dragStart.current;
                if (!start) return;
                move({
                  x: start.offset.x + (e.clientX - start.pointer.x),
                  y: start.offset.y + (e.clientY - start.pointer.y),
                });
              }}
              onPointerUp={() => {
                dragStart.current = null;
              }}
              onPointerCancel={() => {
                dragStart.current = null;
              }}
            >
              {url && (
                // eslint-disable-next-line @next/next/no-img-element -- 방금 고른 로컬 파일이라 최적화 대상이 아니다.
                <img
                  src={url}
                  alt="자를 사진"
                  draggable={false}
                  className="absolute top-1/2 left-1/2 max-w-none"
                  style={{
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  }}
                />
              )}
              {/* 원형 바깥을 어둡게 덮는다. 큰 spread의 그림자를 원에 걸면 원만 뚫린
                  모양이 되고, 부모의 overflow-hidden이 넘치는 부분을 잘라 준다. */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">확대</span>
              <input
                type="range"
                aria-label="확대"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              끌어서 위치를 맞추고 슬라이더로 확대하세요. 원 안쪽이 실제로 보이는 부분입니다.
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                취소
              </Button>
              <Button type="button" size="sm" disabled={!image} onClick={save}>
                이 영역으로 저장
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
