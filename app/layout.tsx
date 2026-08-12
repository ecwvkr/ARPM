import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { auth } from "@/auth";
import { pickForeground } from "@/lib/color";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

// 시스템 다크모드 설정을 감지해 .dark 클래스를 반영한다. 페인트 전에 실행되어야
// 깜빡임이 없으므로 next/script의 beforeInteractive 전략으로 <head>에 주입한다.
const THEME_INIT_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');document.documentElement.classList.toggle('dark',m.matches);m.addEventListener('change',function(e){document.documentElement.classList.toggle('dark',e.matches);});}catch(e){}})();`;

// 한글 폴백: Inter는 한글 글리프가 없으므로, 없는 글자는 시스템 한글 폰트로 자연히 넘어가도록 지정.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "Noto Sans KR",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: "AR_PM",
  description: "파트너·프로젝트 관리 툴",
  appleWebApp: {
    title: "AR_PM",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const accentColor = session?.user?.accentColor;
  const accentStyle = accentColor
    ? ({
        "--primary": accentColor,
        "--ring": accentColor,
        "--primary-foreground": pickForeground(accentColor),
      } as CSSProperties)
    : undefined;

  return (
    <html
      lang="ko"
      className={cn("h-full antialiased", "font-sans", inter.variable)}
      style={accentStyle}
      suppressHydrationWarning
    >
      <body className={`min-h-full flex flex-col ${session ? "pb-16" : ""}`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
        {session && <BottomNav />}
      </body>
    </html>
  );
}
