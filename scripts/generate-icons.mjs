// 로고를 바꿀 때마다 app/icon.svg만 교체하고 `npm run generate:icons`를 실행하면
// 나머지 아이콘이 전부 새 로고로 재생성된다.
//   · app/favicon.ico          구형 브라우저 폴백
//   · public/icon-192.png      설치형 앱(PWA)·안드로이드 런처
//   · public/icon-512.png      설치형 앱(PWA)·스플래시
// 설치형으로 인정받으려면 매니페스트에 적은 크기와 실제 파일 크기가 맞아야 한다.
// (예전 icon-512.png는 512라고 적혀 있었지만 실제로는 2048x2049였다.)
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "app/icon.svg");
const OUTPUT = path.join(process.cwd(), "app/favicon.ico");
const SIZES = [16, 32, 48];
const APP_ICON_SIZES = [192, 512];
// 매니페스트의 background_color와 맞춘다 — 투명 배경이면 안드로이드 런처가 제멋대로
// 채워 넣어서 로고가 잘려 보인다.
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

function buildIco(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngBuffers.length, 4);

  const entries = [];
  let offset = 6 + pngBuffers.length * 16;

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image data size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

const pngBuffers = await Promise.all(
  SIZES.map(async (size) => ({
    size,
    buffer: await sharp(SOURCE).resize(size, size).png().toBuffer(),
  })),
);

await writeFile(OUTPUT, buildIco(pngBuffers));
console.log(`favicon.ico 생성 완료 (${SIZES.join("/")}px, 원본: app/icon.svg)`);

// 앱 아이콘은 정사각형이어야 한다 — maskable로 쓰려면 특히 그렇다.
for (const size of APP_ICON_SIZES) {
  const out = path.join(process.cwd(), `public/icon-${size}.png`);
  await sharp(SOURCE).resize(size, size, { fit: "contain", background: BACKGROUND }).png().toFile(out);
  console.log(`icon-${size}.png 생성 완료`);
}
