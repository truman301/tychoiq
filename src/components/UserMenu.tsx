"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function UserMenu({ email, name }: { email: string; name?: string | null }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  const initial = (name || email).trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-white ring-1 ring-sidebar-border">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-white">{name || email.split("@")[0]}</div>
        <div className="truncate text-[11px] text-sidebar-muted">{email}</div>
      </div>
      <button
        onClick={logout}
        title="Sign out"
        className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
