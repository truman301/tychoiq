import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SidebarNav } from "@/components/SidebarNav";
import { UserMenu } from "@/components/UserMenu";
import { Logo } from "@/components/Logo";
import { getSessionContext } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tychoiq.com"),
  title: {
    default: "Tycho IQ — AI Prospect Discovery",
    template: "%s · Tycho IQ",
  },
  description:
    "Tycho IQ is an AI-trained, evidence-first prospect discovery and market-mapping platform. Train the model, scan a region, and score fit and risk — every result backed by a source.",
  applicationName: "Tycho IQ",
  keywords: [
    "prospect discovery",
    "ICP",
    "lead generation",
    "market mapping",
    "account sourcing",
    "deal sourcing",
    "healthcare staffing prospects",
    "evidence-based scoring",
  ],
  authors: [{ name: "Tycho IQ" }],
  openGraph: {
    type: "website",
    siteName: "Tycho IQ",
    title: "Tycho IQ — AI Prospect Discovery",
    description:
      "Train-first, evidence-first prospect discovery. Find the accounts traditional databases miss.",
    url: "https://tychoiq.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tycho IQ — AI Prospect Discovery",
    description:
      "Train-first, evidence-first prospect discovery. Find the accounts traditional databases miss.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#0c0c22",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {ctx ? (
          <div className="flex min-h-screen">
            <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
              <Link
                href="/"
                className="flex items-center border-b border-sidebar-border px-5 py-[18px] transition-opacity hover:opacity-90"
              >
                <Logo tone="dark" />
              </Link>
              <SidebarNav />
              <div className="mt-auto border-t border-sidebar-border">
                <UserMenu email={ctx.user.email} name={ctx.user.name} />
                <div className="flex flex-wrap gap-x-2 gap-y-1 px-4 pb-4 text-[10px] uppercase tracking-wider text-sidebar-muted">
                  <span>Train-first</span>
                  <span aria-hidden>·</span>
                  <span>Evidence-first</span>
                  <span aria-hidden>·</span>
                  <span>Compliance-safe</span>
                </div>
              </div>
            </aside>
            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto max-w-7xl px-5 py-7 md:px-8">{children}</div>
            </main>
          </div>
        ) : (
          <main className="min-h-screen">{children}</main>
        )}
      </body>
    </html>
  );
}
