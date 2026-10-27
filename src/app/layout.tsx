import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KiwameroTracker | VALORANT 戦績・アカウント査定",
  description: "VALORANT プレイヤーの戦績追跡・アカウント査定・スマーフ診断",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${outfit.variable} ${notoSansJp.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-screen flex flex-col antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
