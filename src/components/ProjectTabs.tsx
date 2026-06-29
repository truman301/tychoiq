"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/icp`, label: "ICP Builder" },
    { href: `${base}/training`, label: "Training Center" },
    { href: `${base}/scans`, label: "Scan Runs" },
    { href: `${base}/candidates`, label: "Candidates" },
    { href: `${base}/map`, label: "Map" },
    { href: `${base}/exports`, label: "Exports" },
  ];
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
