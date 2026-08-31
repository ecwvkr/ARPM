import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AR_PM",
    short_name: "AR_PM",
    description: "파트너·프로젝트 관리 툴",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    // 크기는 실제 파일과 맞아야 한다 — 안 맞으면 크롬이 설치용 아이콘으로 안 쓴다.
    // 파일은 `npm run generate:icons`로 app/icon.svg에서 만든다.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
