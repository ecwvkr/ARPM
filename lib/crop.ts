// 1:1 크롭 계산. 화면에서는 <img>를 CSS transform으로 옮겨 보여주고, 저장할 때는 그
// 배치를 캔버스에 똑같이 재현해야 한다. 두 곳이 어긋나면 "보이는 것과 다르게 잘리는"
// 버그가 되므로 계산은 여기 한곳에만 둔다(npm run check:crop).

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// 이미지가 정사각 틀을 빈틈없이 덮는 최소 배율. 여기서 더 줄이면 틀 안에 여백이 생긴다.
export function coverScale(image: Size, viewport: number): number {
  return Math.max(viewport / image.width, viewport / image.height);
}

// 끌어서 옮길 수 있는 한계(중심 기준). 이보다 더 밀면 가장자리가 틀 안으로 들어온다.
export function maxOffset(image: Size, viewport: number, scale: number): Offset {
  return {
    x: Math.max(0, (image.width * scale - viewport) / 2),
    y: Math.max(0, (image.height * scale - viewport) / 2),
  };
}

export function clampOffset(offset: Offset, image: Size, viewport: number, scale: number): Offset {
  const max = maxOffset(image, viewport, scale);
  return { x: clamp(offset.x, -max.x, max.x), y: clamp(offset.y, -max.y, max.y) };
}

// 화면 배치를 원본 이미지에서 잘라낼 정사각형으로 되돌린다.
// 이미지를 오른쪽으로 밀면(offset.x > 0) 보이는 부분은 왼쪽으로 간다 — 그래서 뺀다.
export function sourceRect(
  image: Size,
  viewport: number,
  scale: number,
  offset: Offset,
): { x: number; y: number; side: number } {
  const side = viewport / scale;
  return {
    x: image.width / 2 - offset.x / scale - side / 2,
    y: image.height / 2 - offset.y / scale - side / 2,
    side,
  };
}
