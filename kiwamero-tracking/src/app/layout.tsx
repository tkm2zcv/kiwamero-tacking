import type { Metadata } from "next";
import { Roboto, Poppins } from "next/font/google";
import "./globals.css";
import { getLocale, getDict } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: { default: "Kiwamero Tracking — VALORANT Stats", template: "%s | Kiwamero Tracking" },
  description: "VALORANT tracker: stats, match history, agents, maps — tracker.gg-style UI.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDict();
  return (
    <html lang={locale}>
      <body className={`${roboto.variable} ${poppins.variable} antialiased`}>
        <I18nProvider locale={locale} dict={dict}>
          <SiteNav />
          <main className="mx-auto min-h-[70vh] w-full max-w-[1400px] px-4">{children}</main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
