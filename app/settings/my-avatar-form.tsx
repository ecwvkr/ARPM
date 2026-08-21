"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyAvatar } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/global-toast";

const SIZE = 128;

// 원본을 그대로 올리면 몇 MB짜리 사진이 그대로 DB에 들어가므로, 브라우저에서
// 가운데를 정사각형으로 잘라 128px JPEG로 다시 인코딩한다(원형 아바타라 가장자리는
// 어차피 잘린다). 결과는 보통 5KB 안팎.
async function compressToSquare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없습니다.");

  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function MyAvatarForm({ userId, hasAvatar }: { userId: string; hasAvatar: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 사진 주소는 그대로라 브라우저 캐시가 예전 사진을 계속 보여준다 — 저장할 때마다
  // 쿼리를 바꿔 이 화면의 미리보기만 새로 받아온다.
  const [version, setVersion] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(hasAvatar);

  function save(dataUrl: string | null, message: string) {
    startTransition(async () => {
      const error = await updateMyAvatar(dataUrl);
      if (error) {
        setErrorMessage(error);
        return;
      }
      setErrorMessage(null);
      setHasPhoto(dataUrl !== null);
      setVersion((v) => v + 1);
      showToast(message);
      router.refresh();
    });
  }

  async function handleFile(file: File) {
    try {
      save(await compressToSquare(file), "프로필 사진이 저장되었습니다");
    } catch {
      setErrorMessage("이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- 라우트가 내려주는 원본 그대로 쓴다.
            <img src={`/api/avatar/${userId}?v=${version}`} alt="프로필 사진" className="size-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">없음</span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFile(file);
            }}
          />
          <Button type="button" size="sm" disabled={isPending} onClick={() => fileInput.current?.click()}>
            {hasPhoto ? "사진 변경" : "사진 등록"}
          </Button>
          {hasPhoto && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => save(null, "프로필 사진이 삭제되었습니다")}
            >
              삭제
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        등록하지 않으면 이름 첫 글자가 표시됩니다. 올린 사진은 자동으로 정사각형 {SIZE}px로 줄여 저장합니다.
      </p>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
