import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ThemeScript } from "@/components/site/ThemeScript";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-display",
  style: ["normal", "italic"],
});

const sans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

const description =
  "A beginner-friendly visual guide to landmark AI research papers. Each paper has a plain-English explanation, interactive figures, a short quiz, and a link to the original work.";

export const metadata: Metadata = {
  metadataBase: new URL("https://papers-a-day.subdomain.wtf"),
  title: {
    default: "Papers a Day",
    template: "%s · Papers a Day",
  },
  description,
  applicationName: "Papers a Day",
  openGraph: {
    title: "Papers a Day",
    description,
    url: "https://papers-a-day.subdomain.wtf",
    siteName: "Papers a Day",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Papers a Day",
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>
        <ThemeScript />
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <p>
            Written for a first reading. Figures on each paper use toy or example numbers, and the
            page says so wherever that is the case.
          </p>
        </footer>
      </body>
    </html>
  );
}
