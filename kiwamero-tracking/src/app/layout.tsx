import type { Metadata } from "next";
import { Roboto, Saira } from "next/font/google";
import "./globals.css";
import "./tracker-ui.css";
import "./trn-v3.css";
import { getLocale, getDict } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
});
const saira = Saira({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-saira",
});

export const metadata: Metadata = {
  title: { default: "Kiwamero Tracking — VALORANT Stats", template: "%s | Kiwamero Tracking" },
  description: "VALORANT tracker: stats, match history, agents, maps — tracker.gg-style UI.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDict();
  return (
    <html lang={locale} className={`${roboto.variable} ${saira.variable}`}>
      <body className="antialiased">
        <I18nProvider locale={locale} dict={dict}>
          <div className="kt-shell">
            <SiteNav />
            <main className="kt-main">{children}</main>
            <SiteFooter />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
