import { OrbitLogo } from "@/components/brand/orbit-logo";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  markClassName?: string;
  lede?: string;
  glow?: boolean;
  markOnly?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { mark: "h-6 w-6", word: "text-[15px]", lede: "text-[11px]", gap: "gap-2" },
  md: { mark: "h-7 w-7", word: "text-base", lede: "text-xs", gap: "gap-2.5" },
  lg: { mark: "h-8 w-8", word: "text-xl", lede: "text-sm", gap: "gap-3" },
};

/** Lockup ManyTalks Bot: órbita + wordmark. */
export function BrandMark({
  className,
  markClassName,
  lede,
  markOnly,
  size = "md",
}: Props) {
  const s = sizes[size];
  if (markOnly) {
    return <OrbitLogo className={cn(s.mark, markClassName)} title={BRAND.name} />;
  }
  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <OrbitLogo className={cn(s.mark, markClassName)} />
      <div className="min-w-0 leading-none">
        <p
          className={cn(
            "font-display font-medium tracking-[-0.04em] text-[var(--grokbott-text-primary)]",
            s.word,
          )}
        >
          {BRAND.wordPrimary}
          <span className="font-normal text-[var(--grokbott-text-secondary)]">
            {" "}
            {BRAND.wordSecondary}
          </span>
        </p>
        {lede ? (
          <p className={cn("mt-1 text-[var(--grokbott-text-secondary)]", s.lede)}>{lede}</p>
        ) : null}
      </div>
    </div>
  );
}
