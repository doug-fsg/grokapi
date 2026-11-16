import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-3 text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
