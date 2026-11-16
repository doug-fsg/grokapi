"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = [
    { id: "dark", icon: Moon, label: "Escuro" },
    { id: "light", icon: Sun, label: "Claro" },
    { id: "system", icon: Monitor, label: "Sistema" },
  ] as const;

  return (
    <div
      className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border p-0.5"
      role="group"
      aria-label="Tema"
      aria-hidden={!mounted}
    >
      {items.map((item) => {
        const active = mounted && theme === item.id;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!mounted}
            title={item.label}
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => setTheme(item.id)}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors",
              "disabled:pointer-events-none disabled:opacity-50",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-[var(--grokbott-surface-3)] hover:text-foreground",
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
