import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** @deprecated ignorado — marcas grandes não usam glow */
  glow?: boolean;
  title?: string;
};

/**
 * Mark ManyTalks Bot — redução geométrica (estilo Linear/Vercel):
 * núcleo sólido + um arco. Uma cor. Legível a 16px.
 */
export function OrbitLogo({ className = "h-8 w-8", title }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0 text-[var(--grokbott-accent-sunset)]", className)}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      {/* arco — órbita incompleta */}
      <path
        d="M25.5 11.2a10 10 0 1 1-3.2-4.4"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* núcleo */}
      <circle cx="16" cy="16" r="5" fill="currentColor" />
    </svg>
  );
}
