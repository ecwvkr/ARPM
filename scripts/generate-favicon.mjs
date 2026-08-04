// 로고를 바꿀 때마다 app/icon.svg만 교체하고 `npm run generate:favicon`을 실행하면
// app/favicon.ico(구형 브라우저 폴백용)가 새 로고로 재생성된다.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "app/icon.svg");
const OUTPUT = path.join(process.cwd(), "app/favicon.ico");
const SIZES = [16, 32, 48];

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
