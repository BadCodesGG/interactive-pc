import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import Link from "next/link";
import { credits } from "@/data/credits";
import { ThemeToggle, themeScript } from "@/engine/explode";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const SITE_TITLE = "Interactive: the gaming PC";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE.url] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${plexMono.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint, so a dark visitor never sees a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border py-3">
          <nav aria-label="Site" className="mx-auto flex max-w-7xl items-center px-4 md:px-6 justify-between gap-3 text-sm">
            {/* The links wrap among themselves; the toggle keeps the right edge of the first row. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-5">
              <Link href="/" className="font-display font-bold text-ink hover:text-accent">
                Interactive
              </Link>
              <Link href="/" className="text-ink-secondary underline-offset-4 hover:text-accent hover:underline">
                Explode<span className="hidden sm:inline">d PC</span>
              </Link>
              <Link href="/build" className="text-ink-secondary underline-offset-4 hover:text-accent hover:underline">
                Build it
              </Link>
            </div>
            <ThemeToggle className="shrink-0" />
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border py-6 text-sm text-ink-tertiary">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 md:flex-row md:px-6 md:items-center md:justify-between">
            <p>
              Built by{" "}
              <a href="https://badcodes.dev" className="text-ink-secondary underline-offset-4 hover:text-accent hover:underline">
                badcodes.dev
              </a>
            </p>
            <ul aria-label="Credits" className="flex max-w-2xl flex-col gap-1 md:text-right">
              {credits.map((c) => (
                <li key={c.name}>
                  <a href={c.url} className="underline-offset-4 hover:text-accent hover:underline" rel="noreferrer">
                    {c.line}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
