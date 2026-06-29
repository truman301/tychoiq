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
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{name || email.split("@")[0]}</div>
        <div className="truncate text-[11px] text-muted-foreground">{email}</div>
      </div>
      <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
