// 이름 첫 글자 원형 아바타. 카드마다 반복되던 "이름 · master" 같은 텍스트를
// 대체하기 위한 것으로, 전체 이름은 title 툴팁으로만 노출한다.
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
  const sizeClass = size === "xs" ? "size-5 text-xs" : "size-6 text-xs";
  return (
    <span
      title={name}
      style={{ backgroundColor: colorForId(id) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-card font-bold text-white ${sizeClass} ${className}`}
    >
      {name.slice(0, 1)}
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
