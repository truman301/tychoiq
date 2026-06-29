import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SidebarNav } from "@/components/SidebarNav";
import { UserMenu } from "@/components/UserMenu";
import { getSessionContext } from "@/lib/auth";
import { Target } from "lucide-react";

export const metadata: Metadata = {
  title: "TychoIQ — AI Prospect Discovery",
  description: "AI-trained, evidence-first prospect discovery and market-mapping platform.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();

  return (
    <html lang="en">
      <body className="min-h-screen">
        {ctx ? (
          <div className="flex min-h-screen">
            <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
              <Link href="/" className="flex items-center gap-2 border-b px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Target className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">TychoIQ</div>
                  <div className="text-[11px] text-muted-foreground">Prospect discovery</div>
                </div>
              </Link>
              <SidebarNav />
              <div className="mt-auto border-t">
                <UserMenu email={ctx.user.email} name={ctx.user.name} />
                <div className="px-4 pb-4 text-[11px] text-muted-foreground">
                  Train-first · Evidence-first · Compliance-safe
                </div>
              </div>
            </aside>
            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
            </main>
          </div>
        ) : (
          <main className="min-h-screen">{children}</main>
        )}
      </body>
    </html>
  );
}
