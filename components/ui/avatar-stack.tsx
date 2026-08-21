"use client";

import { useState } from "react";

// 이름 첫 글자 원형 아바타. 카드마다 반복되던 "이름 · master" 같은 텍스트를
// 대체하기 위한 것으로, 전체 이름은 title 툴팁으로만 노출한다.
// 프로필 사진을 등록한 사용자는 첫 글자 위에 사진이 덮인다.
const AVATAR_PALETTE = [
  "oklch(0.6 0.12 25)",
  "oklch(0.6 0.12 70)",
  "oklch(0.6 0.12 145)",
  "oklch(0.6 0.12 195)",
  "oklch(0.6 0.12 250)",
  "oklch(0.6 0.12 300)",
  "oklch(0.6 0.12 340)",
];

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function Avatar({
  id,
  name,
  size = "sm",
  className = "",
}: {
  id: string;
  name: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  // 사진 유무를 미리 알려면 칩 데이터마다 플래그를 실어 날라야 한다. 대신 항상
  // 요청해 보고 없으면(404) 첫 글자를 그대로 둔다 — 404도 캐시되므로 재요청은 없다.
  const [state, setState] = useState<"pending" | "loaded" | "none">("pending");
  const sizeClass = size === "xs" ? "size-5 text-xs" : "size-6 text-xs";

  return (
    <span
      title={name}
      style={{ backgroundColor: colorForId(id) }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card font-bold text-white ${sizeClass} ${className}`}
    >
      {name.slice(0, 1)}
      {state !== "none" && (
        // eslint-disable-next-line @next/next/no-img-element -- 라우트가 내려주는 원본 그대로 쓰면 되므로 next/image의 최적화가 필요 없다.
        <img
          src={`/api/avatar/${id}`}
          alt=""
          onLoad={() => setState("loaded")}
          onError={() => setState("none")}
          className={`absolute inset-0 size-full object-cover ${state === "loaded" ? "" : "opacity-0"}`}
        />
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size,
}: {
  people: { id: string; name: string }[];
  max?: number;
  size?: "xs" | "sm";
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const overflowSizeClass = size === "xs" ? "size-5 text-xs" : "size-6 text-xs";

  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.id} id={p.id} name={p.name} size={size} className={i > 0 ? "-ml-2" : ""} />
      ))}
      {overflow > 0 && (
        <span
          className={`-ml-2 inline-flex shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted font-bold text-muted-foreground ${overflowSizeClass}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
