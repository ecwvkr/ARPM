// 1:1 크롭 계산(lib/crop.ts)을 확인한다. 실행:
//   npm run check:crop
//
// 화면은 <img>를 CSS transform으로 옮겨 보여 주고, 저장은 같은 배치를 캔버스에 다시
// 그린다. 두 계산이 어긋나면 "보이는 것과 다르게 잘리는" 버그가 되므로, 되돌림
// (화면 배치 -> 원본에서 잘라낼 영역)이 맞는지 여기서 확인한다.
//
// 순수 함수만 본다 — DB도 브라우저도 필요 없다.
import { coverScale, maxOffset, clampOffset, sourceRect } from "../lib/crop";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

const V = 256;

function main() {
  // 가로로 긴 사진: 세로를 기준으로 덮어야 한다.
  const wide = { width: 1200, height: 600 };
  check("가로로 긴 사진은 세로 기준 배율", near(coverScale(wide, V), V / 600), `${coverScale(wide, V)}`);
  // 세로로 긴 사진: 가로 기준.
  const tall = { width: 600, height: 1200 };
  check("세로로 긴 사진은 가로 기준 배율", near(coverScale(tall, V), V / 600));
  // 정사각형은 남는 방향이 없다 — 끌어도 움직이지 않아야 한다.
  const square = { width: 800, height: 800 };
  const s0 = coverScale(square, V);
  const m0 = maxOffset(square, V, s0);
  check("정사각 원본은 확대 전에 움직일 여지 없음", near(m0.x, 0) && near(m0.y, 0));

  // 가로로 긴 사진은 좌우로만 움직인다.
  const sw = coverScale(wide, V);
  const mw = maxOffset(wide, V, sw);
  check("가로로 긴 사진은 좌우로만 이동", mw.x > 0 && near(mw.y, 0), `x=${mw.x.toFixed(1)}`);
  check("한계 밖으로 끌면 한계에서 멈춤",
    near(clampOffset({ x: 99999, y: 50 }, wide, V, sw).x, mw.x));

  // 되돌림: 가운데 그대로면 원본 한가운데의 정사각형이 나와야 한다.
  const center = sourceRect(wide, V, sw, { x: 0, y: 0 });
  check("가운데 그대로면 원본 한가운데", near(center.side, 600) && near(center.y, 0) && near(center.x, (1200 - 600) / 2),
    `x=${center.x} side=${center.side}`);

  // 확대하면 잘라내는 영역이 그만큼 좁아진다.
  const zoomed = sourceRect(wide, V, sw * 2, { x: 0, y: 0 });
  check("2배 확대하면 잘라낼 영역이 절반", near(zoomed.side, 300));

  // 이미지를 오른쪽으로 밀면 보이는 부분은 원본의 왼쪽으로 간다.
  const moved = sourceRect(wide, V, sw, { x: 40, y: 0 });
  check("오른쪽으로 밀면 원본의 왼쪽이 보인다", moved.x < center.x, `${moved.x.toFixed(1)} < ${center.x}`);
  check("민 만큼만 정확히 이동", near(center.x - moved.x, 40 / sw));

  // 한계까지 밀면 잘라낼 영역이 원본 경계에 딱 붙어야 한다(밖으로 나가면 검은 띠가 생긴다).
  const edge = sourceRect(wide, V, sw, { x: mw.x, y: 0 });
  check("왼쪽 끝까지 밀면 x=0", near(edge.x, 0), `x=${edge.x}`);
  const other = sourceRect(wide, V, sw, { x: -mw.x, y: 0 });
  check("오른쪽 끝까지 밀면 원본 오른쪽 경계", near(other.x + other.side, wide.width),
    `${(other.x + other.side).toFixed(1)} = ${wide.width}`);

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main();
