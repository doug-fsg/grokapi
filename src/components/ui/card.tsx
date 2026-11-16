import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-[var(--grokbott-surface-2)] p-5",
        className,
      )}
      {...props}
    />
  );
}
