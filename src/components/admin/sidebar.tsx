"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, LayoutDashboard, LogOut, ScrollText, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/grokbots", label: "ManyTalks Bots", icon: Bot },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function AdminSidebar() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-[var(--grokbott-surface-1)] md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="px-5 py-4 md:py-5">
        <BrandMark size="sm" lede="Operador" />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
        {items.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-sm",
                active
                  ? "bg-[var(--grokbott-surface-3)] text-[var(--grokbott-text-primary)] shadow-[inset_2px_0_0_var(--grokbott-accent-sunset)]"
                  : "text-[var(--grokbott-text-secondary)] hover:bg-[var(--grokbott-surface-3)] hover:text-[var(--grokbott-text-primary)]",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        className="gb-press mx-3 mb-3 flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm text-[var(--grokbott-text-secondary)] hover:bg-[var(--grokbott-surface-3)] hover:text-[var(--grokbott-text-primary)]"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/login");
        }}
      >
        <LogOut className="h-4 w-4" />
        Sair do painel
      </button>
    </aside>
  );
}
