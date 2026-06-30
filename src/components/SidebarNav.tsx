"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderPlus, Settings, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projects/new", label: "New project", icon: FolderPlus },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "How it works", icon: BookOpen },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] transition-colors",
                active ? "text-white" : "text-sidebar-muted group-hover:text-white",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
